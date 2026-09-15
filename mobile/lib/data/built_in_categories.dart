import '../models/category.dart';

/// Copia manual de los `id`/`label` de `CATEGORIES` en
/// `src/lib/categories.js` (repo web) — sin iconos/colores ni
/// subcategorías, que no aplican aquí. Si `categories.js` cambia (se
/// agrega/renombra una categoría), esta lista debe actualizarse a mano;
/// mismo riesgo ya aceptado con los `packageName` de apps monitoreadas.
const List<Category> builtInCategories = [
  Category(id: 'comida', label: 'Comida'),
  Category(id: 'transporte', label: 'Transporte'),
  Category(id: 'renta', label: 'Renta'),
  Category(id: 'entretenimiento', label: 'Entretenimiento'),
  Category(id: 'salud', label: 'Salud'),
  Category(id: 'compras', label: 'Compras'),
  Category(id: 'servicios', label: 'Servicios'),
  Category(id: 'otros', label: 'Otros'),
  Category(id: 'bebe', label: 'Bebé'),
  Category(id: 'mascotas', label: 'Mascotas'),
];
