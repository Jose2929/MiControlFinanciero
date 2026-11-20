import { Card } from '../ui/Card'
import { Select } from '../ui/Select'
import { MEDIO_LABELS } from '../../lib/budget'
import { CATCH_ALL, isEnvelopeLine } from '../../lib/budgetEnvelopes'

// Medios de donde sale gasto diario. La TDC solo lleva cargos fijos y el
// ahorro no se gasta, así que ahí no hay nada que ligar.
const LINK_MEDIOS = ['debito', 'efectivo', 'tdc2']

function LinkRow({ label, hint, ariaLabel, value, options, onChange }) {
  return (
    <div className="flex items-center gap-3 px-1 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{label}</p>
        {hint && <p className="truncate text-xs text-muted">{hint}</p>}
      </div>
      <Select
        aria-label={ariaLabel}
        containerClassName="w-44 shrink-0"
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Ninguno</option>
        {options.map((line) => (
          <option key={line.id} value={line.id}>
            {line.name}
          </option>
        ))}
      </Select>
    </div>
  )
}

// Liga cada categoría con el sobre que debe descontar, medio por medio. Es lo
// que conecta Registro con Presupuesto: al registrar un gasto, su sobre ya
// viene elegido; y los gastos sin sobre propio (los de antes, los que entran
// por la app del celular, los recurrentes) restan del sobre de su categoría.
export function CategoryLinksCard({ plan, categories, onChange }) {
  const blocks = LINK_MEDIOS.map((medio) => ({
    medio,
    options: plan.lines.filter((l) => l.medio === medio && isEnvelopeLine(l)),
  })).filter((block) => block.options.length > 0)

  if (blocks.length === 0) return null

  return (
    <Card className="p-4">
      <div className="px-1">
        <h3 className="text-sm font-semibold text-ink">Categorías y sobres</h3>
        <p className="mt-0.5 text-xs text-muted">
          Elige de qué sobre sale cada categoría. Al registrar un gasto, el sobre ya viene elegido, y los gastos que no
          traen sobre (los de antes, los del celular, los recurrentes) también restan de ahí. Un mismo gasto cuenta en el
          sobre de la cuenta con la que se pagó.
        </p>
      </div>

      {blocks.map(({ medio, options }) => {
        const links = plan.categoryEnvelopes[medio] || {}
        const current = (key) => (options.some((l) => l.id === links[key]) ? links[key] : '')
        return (
          <div key={medio} className="mt-5">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{MEDIO_LABELS[medio]}</p>
            <div className="mt-1 divide-y divide-line">
              {categories.map((category) => (
                <LinkRow
                  key={category.id}
                  label={category.label}
                  ariaLabel={`Sobre de ${category.label} en ${MEDIO_LABELS[medio]}`}
                  value={current(category.id)}
                  options={options}
                  onChange={(lineId) => onChange(medio, category.id, lineId)}
                />
              ))}
              <LinkRow
                label="Todo lo demás"
                hint="Categorías sin sobre propio"
                ariaLabel={`Sobre para todo lo demás en ${MEDIO_LABELS[medio]}`}
                value={current(CATCH_ALL)}
                options={options}
                onChange={(lineId) => onChange(medio, CATCH_ALL, lineId)}
              />
            </div>
          </div>
        )
      })}
    </Card>
  )
}
