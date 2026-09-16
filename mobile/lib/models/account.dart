enum AccountType { debito, credito, efectivo, ahorro }

AccountType _accountTypeFromString(String? value) {
  return AccountType.values.firstWhere(
    (t) => t.name == value,
    orElse: () => AccountType.debito,
  );
}

/// Espejo de la cuenta real tal como la guarda la PWA en
/// `households/{hid}/profile/accounts/{id}` (ver AddAccountModal.jsx en el
/// repo web). Solo los campos que necesita la pantalla de confirmación.
class Account {
  final String id;
  final String name;
  final AccountType type;
  final String? last4;
  final double? balance;
  final double? limit;
  final double? used;
  // Fase 15.2: disponible para un futuro matching banco↔app de origen
  // (ver D-bank en el plan de Wear OS) — no se usa todavía para nada.
  final String? bank;

  const Account({
    required this.id,
    required this.name,
    required this.type,
    this.last4,
    this.balance,
    this.limit,
    this.used,
    this.bank,
  });

  factory Account.fromMap(String id, Map<dynamic, dynamic> map) {
    return Account(
      id: id,
      name: map['name'] as String? ?? 'Cuenta',
      type: _accountTypeFromString(map['type'] as String?),
      last4: map['last4'] as String?,
      balance: (map['balance'] as num?)?.toDouble(),
      limit: (map['limit'] as num?)?.toDouble(),
      used: (map['used'] as num?)?.toDouble(),
      bank: map['bank'] as String?,
    );
  }

  String get displayLabel => last4 != null ? '$name ($last4)' : name;
}
