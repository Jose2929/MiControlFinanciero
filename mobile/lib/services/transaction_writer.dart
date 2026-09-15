import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';

import '../models/account.dart';
import '../models/category.dart';
import '../models/transaction_type.dart';

/// Fase 10: escritura real de un movimiento confirmado, replicando
/// exactamente `addExpense`/`addIncome` de `FinanceContext.jsx` (repo web) —
/// mismos campos, mismo efecto en el saldo de la cuenta. Nunca hace `set()`
/// del árbol completo: siempre `update()` de rutas puntuales (D1), con
/// `ServerValue.increment` para el ajuste de saldo/usado, así no depende de
/// un valor de cuenta potencialmente desactualizado leído en la Fase 9.
class TransactionWriter {
  final _db = FirebaseDatabase.instance;

  Future<void> confirmMovement({
    required String householdId,
    required TransactionType type,
    required double amount,
    required String note,
    required Account account,
    Category? category,
    required DateTime date,
  }) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    final txId = 'and-${DateTime.now().millisecondsSinceEpoch}';
    final txPath = 'households/$householdId/profile/transactions/$txId';
    final accountPath = 'households/$householdId/profile/accounts/${account.id}';

    final updates = <String, Object?>{};

    if (type == TransactionType.income) {
      updates[txPath] = {
        'id': txId,
        'type': 'income',
        // Sin perfil de ingreso real detrás (no hay forma de saber cuál le
        // corresponde desde una notificación) — `findIncomeProfile` en la
        // PWA ya tolera un id desconocido con un perfil de respaldo
        // ({ label: 'Ingreso', mode: 'fixed' }), así que no rompe nada.
        'incomeSourceId': 'and-detected',
        'amount': amount,
        'accountId': account.id,
        'note': note,
        'date': date.toIso8601String(),
        'createdBy': uid,
      };
      // Igual que addIncome en FinanceContext.jsx: una tarjeta de crédito
      // no recibe ingreso, no se ajusta nada en ese caso.
      if (account.type != AccountType.credito) {
        updates['$accountPath/balance'] = ServerValue.increment(amount);
      }
    } else {
      updates[txPath] = {
        'id': txId,
        'type': 'expense',
        'amount': amount,
        'categoryId': category?.id,
        'subcategoryId': null,
        'accountId': account.id,
        'counterAccountId': null,
        'note': note,
        'date': date.toIso8601String(),
        'createdBy': uid,
      };
      if (account.type == AccountType.credito) {
        updates['$accountPath/used'] = ServerValue.increment(amount);
      } else {
        updates['$accountPath/balance'] = ServerValue.increment(-amount);
      }
    }

    await _db.ref().update(updates);
  }
}
