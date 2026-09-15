/// Espejo de una categoría real (fija o personalizada del hogar), tal como
/// las expone `src/lib/categories.js` (fijas) y
/// `households/{hid}/profile/customCategories` (personalizadas) en el repo
/// web. Solo `id`/`label` importan para el selector de esta pantalla.
class Category {
  final String id;
  final String label;
  final bool isCustom;

  const Category({required this.id, required this.label, this.isCustom = false});

  factory Category.fromCustomMap(String id, Map<dynamic, dynamic> map) {
    return Category(
      id: id,
      label: map['label'] as String? ?? id,
      isCustom: true,
    );
  }
}
