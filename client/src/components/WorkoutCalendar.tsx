import { calendarWeeks, monthLabel } from '../lib/calendar'
import type { CalendarActivity } from '../lib/calendar'
import { formatWorkoutDate } from '../lib/workouts'

const weekdays = ['Esmaspäev', 'Teisipäev', 'Kolmapäev', 'Neljapäev', 'Reede', 'Laupäev', 'Pühapäev']

export default function WorkoutCalendar({ month, activity, today, selected, onSelect }: {
  month: string; activity: CalendarActivity; today: string; selected: string | null; onSelect: (date: string) => void
}) {
  return (
    <>
      <table className="workout-calendar">
        <caption className="visually-hidden">{monthLabel(month)} — treeningupäevad</caption>
        <thead><tr>{weekdays.map((day) => <th key={day} scope="col"><abbr title={day}>{day[0]}</abbr></th>)}</tr></thead>
        <tbody>{calendarWeeks(month).map((week, row) => (
          <tr key={row}>{week.map((date, column) => (
            <td key={date ?? `blank-${column}`}>
              {date && <button type="button"
                className={`calendar-day${date === today ? ' calendar-today' : ''}`}
                aria-current={date === today ? 'date' : undefined} aria-pressed={date === selected}
                aria-label={`${formatWorkoutDate(date)}${date === today ? ', täna' : ''}, ${activity[date] ? 'treeninguga päev' : 'treeninguid pole'}`}
                onClick={() => onSelect(date)}>
                <span>{Number(date.slice(-2))}</span>
                <span className="calendar-marker" aria-hidden="true">{activity[date] ? '●' : '\u00a0'}</span>
              </button>}
            </td>
          ))}</tr>
        ))}</tbody>
      </table>
      <p className="calendar-legend">● Treeninguga päev. Täna: allajoonitud kuupäev. Valitud päev: piirjoonega.</p>
      {selected && selected.startsWith(`${month}-`) && <p className="login-notice" role="status">
        {formatWorkoutDate(selected)}: {activity[selected] ? 'sel päeval on treening salvestatud.' : 'sel päeval pole treeninguid.'}
      </p>}
    </>
  )
}
