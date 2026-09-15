import 'dart:async';

import 'package:flutter/material.dart';

import '../../models/account.dart';
import '../../models/category.dart';
import '../../models/parsed_transaction.dart';
import '../../models/pending_confirm_movement.dart';
import '../../models/transaction_type.dart';
import '../../services/household_repository.dart';
import '../../services/notification_deduplicator.dart';
import '../../services/transaction_writer.dart';
import '../home/home_shell.dart';

// Fase 12: chequeo de dedup justo antes de escribir usa una ventana mucho
// más larga que el default de 60s (Fase 6/7) porque una escritura puede
// haber quedado encolada sin conexión bastante más tiempo que eso.
const _confirmedWriteDedupWindow = Duration(hours: 24);
const _saveTimeout = Duration(seconds: 5);
// Fase 12: un DatabaseReference.get() de un solo tiro (sin listener activo)
// se queda esperando al servidor indefinidamente si no hay conexión, no
// usa el caché en disco de la persistencia — sin este timeout, la
// pantalla se vería congelada para siempre en vez de ofrecer reintentar.
const _loadTimeout = Duration(seconds: 8);

enum _SaveOutcome { success, queuedOffline, failed }

/// Pantalla de revisión/edición que se abre al tocar la notificación
/// "Gasto/Ingreso detectado" (Fase 9), y que escribe el movimiento
/// confirmado a Firebase al tocar "Guardar" (Fase 10, ver D5/D1 en el plan
/// de esas fases). También sirve como pantalla de registro manual (Fase
/// 13, ver `ConfirmMovementPage.manual`) — mismo modelo/repositorio, solo
/// que el tipo se elige en pantalla en vez de venir fijo de la notificación.
class ConfirmMovementPage extends StatefulWidget {
  final PendingConfirmMovement movement;
  final bool isManualEntry;

  const ConfirmMovementPage({super.key, required this.movement})
    : isManualEntry = false;

  /// Fase 13: registro manual, sin notificación de origen. `amount: 0` y
  /// `note: null` porque el usuario los llena en pantalla; `timestamp: 0`
  /// hace que `_date` use `DateTime.now()` (misma lógica ya existente).
  const ConfirmMovementPage.manual({super.key})
    : movement = const PendingConfirmMovement(
        sourcePackageName: null,
        amount: 0,
        note: null,
        timestamp: 0,
        type: TransactionType.expense,
      ),
      isManualEntry = true;

  @override
  State<ConfirmMovementPage> createState() => _ConfirmMovementPageState();
}

class _ConfirmMovementPageState extends State<ConfirmMovementPage> {
  final _repository = HouseholdRepository();
  final _writer = TransactionWriter();
  final _deduplicator = NotificationDeduplicator();
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _amountController;
  late final TextEditingController _noteController;
  late DateTime _date;

  late Future<(String?, List<Account>, List<Category>)> _dataFuture;
  late TransactionType _type;
  Account? _selectedAccount;
  Category? _selectedCategory;
  bool _saving = false;

  bool get _isExpense => _type != TransactionType.income;

  @override
  void initState() {
    super.initState();
    _type = widget.movement.type;
    _amountController = TextEditingController(
      text: widget.isManualEntry ? '' : widget.movement.amount.toStringAsFixed(2),
    );
    _noteController = TextEditingController(text: widget.movement.note ?? '');
    _date = widget.movement.timestamp > 0
        ? DateTime.fromMillisecondsSinceEpoch(widget.movement.timestamp)
        : DateTime.now();
    _dataFuture = _loadData();
  }

  Future<(String?, List<Account>, List<Category>)> _loadData() {
    return _fetchData().timeout(_loadTimeout);
  }

  void _retryLoad() {
    setState(() => _dataFuture = _loadData());
  }

  Future<(String?, List<Account>, List<Category>)> _fetchData() async {
    final householdId = await _repository.getHouseholdId();
    if (householdId == null) return (null, <Account>[], <Category>[]);
    final accounts = await _repository.getAccounts(householdId);
    final categories = await _repository.getCategories(householdId);
    return (householdId, accounts, categories);
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  // Si hay una ruta debajo (llegamos aquí con push, no como ruta inicial),
  // basta con volver a ella en vez de reemplazar — evita dejar una
  // "Notificaciones (debug)" duplicada en el stack (warm start de la Fase
  // 9/12, o el registro manual de la Fase 13). Solo cuando esta pantalla
  // es la ruta inicial (cold start de una notificación) hace falta
  // reemplazar, porque no hay nada debajo a lo que volver.
  void _goToDebugPage() {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
    } else {
      navigator.pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeShell(initialIndex: 1)),
      );
    }
  }

  Future<void> _onGuardar(String? householdId) async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedAccount == null || (_isExpense && _selectedCategory == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_isExpense ? 'Elige cuenta y categoría.' : 'Elige una cuenta.')),
      );
      return;
    }
    if (householdId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se encontró tu hogar en Firebase.')),
      );
      return;
    }

    setState(() => _saving = true);

    // Fase 12: la misma notificación cruda ya pasó por el dedup de la
    // Fase 6/7 (ventana de 60s) antes de llegar aquí, pero una escritura
    // puede quedar encolada offline mucho más tiempo que eso — se checa
    // otra vez con una ventana larga, sobre los valores ORIGINALES
    // detectados (no los editados), para no crear un segundo movimiento
    // si el usuario vuelve a confirmar el mismo aviso más tarde. No aplica
    // a un registro manual (Fase 13): no hay notificación original de la
    // que sea "duplicado", cada registro manual es intencional.
    if (!widget.isManualEntry) {
      final originalMovement = ParsedTransaction(
        amount: widget.movement.amount,
        note: widget.movement.note,
        type: widget.movement.type,
        sourcePackageName: widget.movement.sourcePackageName ?? '',
        timestamp: widget.movement.timestamp,
      );
      final isDuplicate = await _deduplicator.isDuplicate(
        originalMovement,
        scope: 'confirmed_write',
        windowMs: _confirmedWriteDedupWindow.inMilliseconds,
      );
      if (isDuplicate) {
        if (!mounted) return;
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Este movimiento parece ya haberse guardado antes.')),
        );
        return;
      }
    }

    final writeFuture = _writer.confirmMovement(
      householdId: householdId,
      type: _type,
      amount: double.parse(_amountController.text),
      note: _noteController.text.trim(),
      account: _selectedAccount!,
      category: _isExpense ? _selectedCategory : null,
      date: _date,
    );

    // El Future de update() no se resuelve hasta que el servidor confirma
    // — sin conexión se quedaría pendiente indefinidamente. Se compite
    // contra un timeout corto para no dejar la pantalla congelada; la
    // persistencia en disco (activada en main.dart) garantiza que la
    // escritura no se pierde aunque no esperemos aquí a que termine.
    var outcome = _SaveOutcome.success;
    Object? fastError;
    try {
      outcome = await Future.any<_SaveOutcome>([
        writeFuture.then((_) => _SaveOutcome.success),
        Future.delayed(_saveTimeout, () => _SaveOutcome.queuedOffline),
      ]);
    } catch (e) {
      outcome = _SaveOutcome.failed;
      fastError = e;
    }

    if (outcome == _SaveOutcome.queuedOffline) {
      // Sigue de fondo; si falla más tarde ya no hay pantalla a la que
      // avisarle, solo se deja constancia en el log.
      unawaited(
        writeFuture.catchError((Object e) {
          debugPrint('[ConfirmMovementPage] escritura diferida falló: $e');
        }),
      );
    }

    if (!mounted) return;

    switch (outcome) {
      case _SaveOutcome.success:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Movimiento guardado.')),
        );
        _goToDebugPage();
      case _SaveOutcome.queuedOffline:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Sin conexión: se guardará solo cuando el teléfono vuelva a tener internet.',
            ),
          ),
        );
        _goToDebugPage();
      case _SaveOutcome.failed:
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo guardar: $fastError')),
        );
    }
  }

  String get _title {
    if (widget.isManualEntry) return 'Registrar movimiento';
    return _type == TransactionType.income ? 'Ingreso detectado' : 'Gasto detectado';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_title)),
      body: FutureBuilder<(String?, List<Account>, List<Category>)>(
        future: _dataFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Sin conexión: no se pudieron cargar tus cuentas y categorías.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _retryLoad,
                      child: const Text('Reintentar'),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: _goToDebugPage,
                      child: const Text('Cancelar'),
                    ),
                  ],
                ),
              ),
            );
          }
          final (householdId, accounts, categories) =
              snapshot.data ?? (null, <Account>[], <Category>[]);
          _selectedAccount ??= accounts.isNotEmpty ? accounts.first : null;
          if (_isExpense) {
            _selectedCategory ??= categories.isNotEmpty ? categories.first : null;
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.isManualEntry) ...[
                    SegmentedButton<TransactionType>(
                      segments: const [
                        ButtonSegment(
                          value: TransactionType.expense,
                          label: Text('Gasto'),
                        ),
                        ButtonSegment(
                          value: TransactionType.income,
                          label: Text('Ingreso'),
                        ),
                      ],
                      selected: {_type},
                      onSelectionChanged: (selection) =>
                          setState(() => _type = selection.first),
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextFormField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Monto',
                      prefixText: '\$ ',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) {
                      final parsed = double.tryParse(value ?? '');
                      return (parsed == null || parsed <= 0) ? 'Ingresa un monto válido' : null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _noteController,
                    decoration: const InputDecoration(
                      labelText: 'Nota / comercio',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<Account>(
                    initialValue: _selectedAccount,
                    decoration: const InputDecoration(
                      labelText: 'Cuenta',
                      border: OutlineInputBorder(),
                    ),
                    items: accounts
                        .map(
                          (a) => DropdownMenuItem(value: a, child: Text(a.displayLabel)),
                        )
                        .toList(),
                    onChanged: accounts.isEmpty
                        ? null
                        : (value) => setState(() => _selectedAccount = value),
                    validator: (value) => value == null ? 'Elige una cuenta' : null,
                  ),
                  // Un ingreso no tiene categoría en el esquema real de la
                  // PWA (usa incomeSourceId, ver TransactionWriter) — no
                  // tiene sentido pedirla aquí para ese caso.
                  if (_isExpense) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<Category>(
                      initialValue: _selectedCategory,
                      decoration: const InputDecoration(
                        labelText: 'Categoría',
                        border: OutlineInputBorder(),
                      ),
                      items: categories
                          .map(
                            (c) => DropdownMenuItem(value: c, child: Text(c.label)),
                          )
                          .toList(),
                      onChanged: categories.isEmpty
                          ? null
                          : (value) => setState(() => _selectedCategory = value),
                      validator: (value) => value == null ? 'Elige una categoría' : null,
                    ),
                  ],
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Fecha'),
                    subtitle: Text(
                      '${_date.day}/${_date.month}/${_date.year}',
                    ),
                    trailing: const Icon(Icons.edit_calendar),
                    onTap: _pickDate,
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _saving ? null : () => _onGuardar(householdId),
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Guardar'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _saving ? null : _goToDebugPage,
                    child: const Text('Descartar'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
