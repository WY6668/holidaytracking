import React, { useMemo } from "react";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function dayLetter(d) {
  return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
}

function monthLabel(d) {
  return d.toLocaleDateString(undefined, { month: "short" });
}

export default function CalendarGrid({ entries, people, monthsAhead = 3 }) {
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(1); // start of current month
    const end = new Date(start);
    end.setMonth(end.getMonth() + monthsAhead);

    const list = [];
    const cur = new Date(start);
    while (cur < end) {
      list.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  }, [monthsAhead]);

  const bookedSet = useMemo(() => {
    // map: "name|YYYY-MM-DD" -> true
    const set = new Set();
    entries.forEach((e) => {
      const s = new Date(e.start + "T00:00:00");
      const en = new Date(e.end + "T00:00:00");
      const cur = new Date(s);
      while (cur <= en) {
        set.add(`${e.name}|${isoDate(cur)}`);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return set;
  }, [entries]);

  if (people.length === 0) {
    return (
      <div className="empty-state">
        <div className="emoji">🌴</div>
        <div className="title">No time off logged yet</div>
        <div className="subtitle">Use "Log time off" above to add the first entry.</div>
      </div>
    );
  }

  let lastMonth = null;

  return (
    <div className="grid-wrap">
      <table className="calendar-grid">
        <thead>
          <tr>
            <th className="grid-month-col"></th>
            <th className="grid-date-col">Date</th>
            <th className="grid-day-col">Day</th>
            {people.map((p) => (
              <th key={p} className="grid-person-col" title={p}>
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const iso = isoDate(d);
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            const m = monthLabel(d);
            const showMonth = m !== lastMonth;
            lastMonth = m;
            return (
              <tr key={iso} className={weekend ? "weekend-row" : ""}>
                <td className="grid-month-col">{showMonth ? m : ""}</td>
                <td className="grid-date-col">{d.getDate()}</td>
                <td className="grid-day-col">{dayLetter(d)}</td>
                {people.map((p) => {
                  const booked = bookedSet.has(`${p}|${iso}`);
                  return (
                    <td key={p} className={booked ? "grid-cell booked" : "grid-cell"} />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="grid-legend">
        <span className="legend-swatch" /> Holiday
      </div>
    </div>
  );
}
