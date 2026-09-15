import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';

import '../data/built_in_categories.dart';
import '../models/account.dart';
import '../models/category.dart';

/// Lecturas puntuales (no en vivo) de los datos reales del hogar del
/// usuario logueado — mismo árbol que ya usa la PWA
/// (`households/{hid}/profile`, ver src/lib/household.js y
/// src/lib/profileSchema.js en el repo web). Read-only: la escritura de
/// transacciones confirmadas es responsabilidad de la Fase 10.
class HouseholdRepository {
  final _db = FirebaseDatabase.instance;

  Future<String?> getHouseholdId() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return null;
    final snapshot = await _db.ref('users/$uid/householdId').get();
    return snapshot.value as String?;
  }

  Future<List<Account>> getAccounts(String householdId) async {
    final snapshot = await _db
        .ref('households/$householdId/profile/accounts')
        .get();
    if (!snapshot.exists) return [];
    final raw = Map<dynamic, dynamic>.from(snapshot.value as Map);
    return raw.entries
        .map(
          (e) => Account.fromMap(e.key as String, e.value as Map<dynamic, dynamic>),
        )
        .toList();
  }

  Future<List<Category>> getCategories(String householdId) async {
    final snapshot = await _db
        .ref('households/$householdId/profile/customCategories')
        .get();
    final custom = <Category>[];
    if (snapshot.exists) {
      final raw = Map<dynamic, dynamic>.from(snapshot.value as Map);
      custom.addAll(
        raw.entries.map(
          (e) => Category.fromCustomMap(
            e.key as String,
            e.value as Map<dynamic, dynamic>,
          ),
        ),
      );
    }
    return [...builtInCategories, ...custom];
  }
}
