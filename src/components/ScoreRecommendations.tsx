import { recommendationsFromDetails } from '@/lib/evaluation-feedback'

export function ScoreRecommendations({ details }: { details: unknown }) {
  const recommendations = recommendationsFromDetails(details)
  if (recommendations.length === 0) return null

  return (
    <div className="mt-4 border-t border-gray2 pt-3">
      <p className="text-xs font-extrabold text-dark mb-2">Что улучшить в первую очередь</p>
      <ol className="space-y-3">
        {recommendations.map((item, index) => (
          <li key={`${index}-${item.action}`} className="rounded-lg border border-gray2 bg-white p-3 text-xs leading-relaxed">
            <p className="font-bold text-dark">{index + 1}. {item.action}</p>
            {item.quote && <p className="mt-1 text-muted">В работе: «{item.quote}»</p>}
            <p className="mt-1 text-dark">Вариант правки: {item.rewrite}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
