import { ratingGrade } from '../../domain/roster'

/** A rating shown as a letter grade with its number, e.g. 「B 72」. */
export function Grade({ value }: { value: number }) {
  const grade = ratingGrade(value)
  return (
    <span className={`grade grade-${grade}`}>
      <span className="grade-letter">{grade}</span>
      <span className="grade-value">{value}</span>
    </span>
  )
}
