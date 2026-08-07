import {
  UtensilsCrossed,
  Car,
  Home,
  Popcorn,
  HeartPulse,
  ShoppingBag,
  Zap,
  MoreHorizontal,
  Tag,
  Star,
  Gift,
  BookOpen,
  Plane,
  Dumbbell,
  PawPrint,
  Coffee,
  Music,
  Briefcase,
  Baby,
  Shirt,
  Building2,
  Stethoscope,
  Blocks,
  Bone,
  Scissors,
  HandCoins,
  PiggyBank,
} from 'lucide-react'

// Fixed order matters: mirrors the validated categorical palette slot order
// (see src/index.css --cat-* vars). Keep new categories appended at the end
// and route overflow into "Otros" rather than inventing a new hue without
// re-running scripts/validate_palette.js from the dataviz skill.
export const CATEGORIES = [
  { id: 'comida', label: 'Comida', icon: UtensilsCrossed, colorVar: '--cat-comida' },
  { id: 'transporte', label: 'Transporte', icon: Car, colorVar: '--cat-transporte' },
  { id: 'renta', label: 'Renta', icon: Home, colorVar: '--cat-renta' },
  { id: 'entretenimiento', label: 'Entretenimiento', icon: Popcorn, colorVar: '--cat-entretenimiento' },
  { id: 'salud', label: 'Salud', icon: HeartPulse, colorVar: '--cat-salud' },
  { id: 'compras', label: 'Compras', icon: ShoppingBag, colorVar: '--cat-compras' },
  { id: 'servicios', label: 'Servicios', icon: Zap, colorVar: '--cat-servicios' },
  { id: 'otros', label: 'Otros', icon: MoreHorizontal, colorVar: '--cat-otros' },
  {
    id: 'bebe',
    label: 'Bebé',
    icon: Baby,
    colorVar: '--cat-bebe',
    subcategories: [
      { id: 'panales', label: 'Pañales', icon: Baby },
      { id: 'ropa-bebe', label: 'Ropa', icon: Shirt },
      { id: 'guarderia', label: 'Guardería', icon: Building2 },
      { id: 'salud-bebe', label: 'Salud del bebé', icon: Stethoscope },
      { id: 'juguetes', label: 'Juguetes', icon: Blocks },
    ],
  },
  {
    id: 'mascotas',
    label: 'Mascotas',
    icon: PawPrint,
    colorVar: '--cat-mascotas',
    subcategories: [
      { id: 'alimento-mascota', label: 'Alimento', icon: Bone },
      { id: 'veterinario', label: 'Veterinario', icon: Stethoscope },
      { id: 'accesorios-mascota', label: 'Accesorios', icon: ShoppingBag },
      { id: 'estetica-mascota', label: 'Estética', icon: Scissors },
    ],
  },
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id) {
  return CATEGORY_MAP[id] || CATEGORY_MAP.otros
}

export function getSubcategory(categoryId, subcategoryId) {
  if (!subcategoryId) return null
  const category = CATEGORY_MAP[categoryId]
  return category?.subcategories?.find((s) => s.id === subcategoryId) || null
}

export function categoryColor(id) {
  return `var(${getCategory(id).colorVar})`
}

// Works for both built-in categories (colorVar -> CSS custom property) and
// user-created custom categories (plain hex stored on `color`).
export function categoryColorValue(category) {
  if (!category) return 'var(--cat-otros)'
  return category.colorVar ? `var(${category.colorVar})` : category.color
}

// Curated picker for user-created custom categories (Profile screen).
export const ICON_LIBRARY = [
  { id: 'Tag', icon: Tag },
  { id: 'Star', icon: Star },
  { id: 'Gift', icon: Gift },
  { id: 'BookOpen', icon: BookOpen },
  { id: 'Plane', icon: Plane },
  { id: 'Dumbbell', icon: Dumbbell },
  { id: 'PawPrint', icon: PawPrint },
  { id: 'Coffee', icon: Coffee },
  { id: 'Music', icon: Music },
  { id: 'Briefcase', icon: Briefcase },
  { id: 'HandCoins', icon: HandCoins },
  { id: 'PiggyBank', icon: PiggyBank },
]

export function getIconById(id) {
  return ICON_LIBRARY.find((i) => i.id === id)?.icon || Tag
}

// Reverse de getIconById: dado el componente de icono, devuelve su id string
// (para serializar categorías personalizadas). Respaldo cuando el objeto no
// trae ya un `iconId`.
export function getIconId(icon) {
  return ICON_LIBRARY.find((i) => i.icon === icon)?.id || 'Tag'
}

export const CUSTOM_CATEGORY_SWATCHES = [
  '#0EA5E9',
  '#F472B6',
  '#84CC16',
  '#FB923C',
  '#38BDF8',
  '#A78BFA',
  '#FACC15',
  '#2DD4BF',
]
