import type { StatsDetail } from '../lib/stats-detail'
import { formatWorkoutDate } from '../lib/workouts'

const format = (value: number) => new Intl.NumberFormat('et-EE', { maximumFractionDigits: 2 }).format(value)

export default function StatsDetailContent({ stats }: { stats: StatsDetail }) {
  return (
    <>
      <h2>{stats.name}</h2>
      <p><time dateTime={stats.date}>{formatWorkoutDate(stats.date)}</time></p>
      <section className="stats-section" aria-labelledby="volume-title">
        <h3 id="volume-title">Treeningu kogumaht</h3>
        <p className="stats-volume">{format(stats.totalVolume)} kg × kordust</p>
        <p>Serveri arvutatud raskuse ja korduste korrutiste summa kõigi seeriate peale.</p>
      </section>
      <section className="stats-section" aria-labelledby="comparison-title">
        <h3 id="comparison-title">Võrdlus eelmise samanimelise treeninguga</h3>
        {stats.comparison ? <dl className="stats-comparison">
          <div><dt>Eelmise treeningu kuupäev</dt><dd>{formatWorkoutDate(stats.comparison.previousDate)}</dd></div>
          <div><dt>Eelmise treeningu kogumaht</dt><dd>{format(stats.comparison.previousVolume)} kg × kordust</dd></div>
          <div><dt>Kogumahu muutus</dt><dd>{stats.comparison.volumeDifference > 0 ? '+' : ''}{format(stats.comparison.volumeDifference)} kg × kordust</dd></div>
        </dl> : <p>Varasemat samanimelist treeningut võrdlemiseks ei ole.</p>}
      </section>
      <section className="stats-section" aria-labelledby="trends-title">
        <h3 id="trends-title">Harjutuste raskuse ja korduste ajalugu</h3>
        <p>Iga rida näitab serveri tagastatud seeriat. Ühel päeval võib olla mitu rida. Ajalugu võib sisaldada ka valitud treeningust hilisemaid päevi.</p>
        {!stats.exerciseTrends.length && <p>Harjutuste ajaloo andmed puuduvad.</p>}
        {stats.exerciseTrends.map((exercise) => (
          <div className="stats-exercise" key={exercise.name}>
            {exercise.points.length ? <table className="stats-table">
              <caption>{exercise.name}</caption>
              <thead><tr><th scope="col">Kuupäev</th><th scope="col">Raskus (kg)</th><th scope="col">Kordused</th></tr></thead>
              <tbody>{exercise.points.map((point, index) => <tr key={`${point.date}-${index}`}>
                <th scope="row"><time dateTime={point.date}>{formatWorkoutDate(point.date)}</time></th>
                <td>{point.weight === null ? 'Andmed puuduvad' : format(point.weight)}</td>
                <td>{point.reps === null ? 'Andmed puuduvad' : format(point.reps)}</td>
              </tr>)}</tbody>
            </table> : <><h4>{exercise.name}</h4><p>Selle harjutuse ajalugu puudub.</p></>}
          </div>
        ))}
      </section>
    </>
  )
}
