import type { IngredientId } from '../game'

interface BurgerVisualProps {
  stack: IngredientId[]
  compact?: boolean
  ghost?: boolean
}

export function BurgerVisual({ stack, compact = false, ghost = false }: BurgerVisualProps) {
  return (
    <div className={`burger-visual ${compact ? 'is-compact' : ''} ${ghost ? 'is-ghost' : ''}`} aria-label="汉堡配料层">
      <div className="burger-stack">
        {[...stack].reverse().map((ingredient, reverseIndex) => {
          const originalIndex = stack.length - reverseIndex - 1
          return (
            <div
              className={`burger-layer layer-${ingredient}`}
              key={`${ingredient}-${originalIndex}`}
              title={ingredient}
            >
              {ingredient === 'bun-top' && <span className="sesame sesame-a" />}
              {ingredient === 'bun-top' && <span className="sesame sesame-b" />}
              {ingredient === 'bun-top' && <span className="sesame sesame-c" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
