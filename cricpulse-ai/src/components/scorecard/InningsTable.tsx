import React, { useState } from 'react';
import { useMatch } from '../../contexts/MatchContext';
import './InningsTable.css';

const InningsTable: React.FC = () => {
  const { matchState } = useMatch();
  const { currentInnings, isLoading } = matchState;
  const [activeTab, setActiveTab] = useState<'batting' | 'bowling' | 'fow'>('batting');

  if (isLoading || !currentInnings) {
    return (
      <div className="innings-table-shell">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '36px', marginBottom: '6px' }} />
        ))}
      </div>
    );
  }

  const { batsman, bowler, fow, extras } = currentInnings;

  return (
    <div className="innings-table-shell">
      {/* Tab selector */}
      <div className="table-tabs">
        {(['batting', 'bowling', 'fow'] as const).map((tab) => (
          <button
            key={tab}
            id={`table-tab-${tab}`}
            className={`table-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'fow' ? 'Fall of Wickets' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Batting Table */}
      {activeTab === 'batting' && (
        <div className="table-scroll">
          <table className="cricket-table">
            <thead>
              <tr>
                <th className="col-name">Batter</th>
                <th>R</th>
                <th>B</th>
                <th>4s</th>
                <th>6s</th>
                <th>SR</th>
              </tr>
            </thead>
            <tbody>
              {batsman.filter((b) => b.balls > 0 || b.outdec !== '').map((bat) => (
                <tr key={bat.id} className={bat.outdec === 'not out' ? 'row-notout' : ''}>
                  <td className="col-name">
                    <div className="player-cell">
                      <span className="player-name">
                        {bat.name}
                        {bat.iscaptain && <span className="player-badge">C</span>}
                        {bat.iskeeper && <span className="player-badge">WK</span>}
                      </span>
                      <span className="player-dismissal">{bat.outdec || 'not out'}</span>
                    </div>
                  </td>
                  <td className="stat-bold">{bat.runs}</td>
                  <td>{bat.balls}</td>
                  <td className="text-yellow">{bat.fours}</td>
                  <td className="text-accent">{bat.sixes}</td>
                  <td className={parseFloat(bat.strkrate) >= 150 ? 'stat-hot' : ''}>{bat.strkrate}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="extras-row">
                  Extras: {extras.total} (w {extras.wides}, nb {extras.noballs}, lb {extras.legbyes}, b {extras.byes})
                </td>
              </tr>
              <tr>
                <td className="total-label">TOTAL</td>
                <td colSpan={5} className="total-value">
                  {currentInnings.score}/{currentInnings.wickets} ({currentInnings.overs} ov)
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Bowling Table */}
      {activeTab === 'bowling' && (
        <div className="table-scroll">
          <table className="cricket-table">
            <thead>
              <tr>
                <th className="col-name">Bowler</th>
                <th>O</th>
                <th>M</th>
                <th>R</th>
                <th>W</th>
                <th>Eco</th>
              </tr>
            </thead>
            <tbody>
              {bowler.map((b) => (
                <tr key={b.id} className={b.wickets >= 3 ? 'row-hero' : ''}>
                  <td className="col-name">
                    <div className="player-cell">
                      <span className="player-name">{b.name}</span>
                    </div>
                  </td>
                  <td>{b.overs}</td>
                  <td>{b.maidens}</td>
                  <td>{b.runs}</td>
                  <td className={b.wickets >= 3 ? 'stat-hot stat-red' : 'stat-bold'}>{b.wickets}</td>
                  <td className={parseFloat(b.economy) < 7 ? 'text-green' : parseFloat(b.economy) > 10 ? 'text-red' : ''}>
                    {b.economy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fall of Wickets */}
      {activeTab === 'fow' && (
        <div className="fow-grid">
          {fow.fow.map((f, i) => (
            <div key={i} className="fow-item">
              <div className="fow-wicket">{i + 1}</div>
              <div className="fow-detail">
                <span className="fow-name">{f.batsmanname}</span>
                <span className="fow-score">{f.runs}/{i + 1} (Ov {f.overnbr})</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InningsTable;
