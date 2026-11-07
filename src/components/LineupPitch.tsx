import type { Formation, Player, Slot } from "../domain/types";

export type PitchPosition = Slot & { winners: string[]; votes: number };

export default function LineupPitch({
  formation,
  positions,
  players,
  averages,
  caption,
  footer,
  selectedPositionId,
  onSelectPosition,
  showVotes = false,
  compact = false,
}: {
  formation: Formation;
  positions: PitchPosition[];
  players: Player[];
  averages: Record<string, number | null>;
  caption: string;
  footer?: string;
  selectedPositionId?: string;
  onSelectPosition?: (id: string) => void;
  showVotes?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`pitch-wrap ${compact ? "compact" : ""}`}>
      <div className="pitch-caption">
        <span>
          <span className="live-dot" />
          {caption}
        </span>
        <span>{formation.name}</span>
      </div>
      <div
        className={`pitch pitch-${formation.format}`}
        aria-label={`Cancha de fútbol ${formation.format}, formación ${formation.name}`}
      >
        <div className="pitch-boundary" />
        <div className="halfway" />
        <div className="center-circle" />
        <div className="penalty top" />
        <div className="penalty bottom" />
        {positions.map((position) => {
          const content = (
            <>
              <div className="stack">
                {position.winners.length ? (
                  position.winners.map((id) => {
                    const player = players.find((item) => item.id === id)!;
                    return (
                      <span className="pitch-player" key={id}>
                        <span className="pitch-rating">
                          {averages[id] == null ? "—" : averages[id].toFixed(1)}
                        </span>
                        <span className="shirt">{player.number}</span>
                        <span className="pitch-name">
                          {player.name.split(" ")[0]}
                        </span>
                      </span>
                    );
                  })
                ) : (
                  <span className="pitch-player">
                    <span className="shirt empty-shirt">
                      {onSelectPosition ? "+" : "—"}
                    </span>
                    <span className="pitch-name">
                      {onSelectPosition ? "Elegir" : "Sin votos"}
                    </span>
                  </span>
                )}
              </div>
              <span className="position-label">
                {position.label}
                {position.winners.length > 1 ? " · EMPATE" : ""}
              </span>
              {showVotes && position.votes > 0 && (
                <span className="slot-votes">
                  {position.votes} voto{position.votes !== 1 ? "s" : ""}
                </span>
              )}
            </>
          );
          const style = { left: `${position.x}%`, top: `${position.y}%` };
          return onSelectPosition ? (
            <button
              key={position.id}
              type="button"
              className={`position editable-position ${selectedPositionId === position.id ? "selected-position" : ""}`}
              style={style}
              aria-label={`Elegir jugador para ${position.label}`}
              aria-pressed={selectedPositionId === position.id}
              onClick={() => onSelectPosition(position.id)}
            >
              {content}
            </button>
          ) : (
            <div key={position.id} className="position" style={style}>
              {content}
            </div>
          );
        })}
      </div>
      {footer && <div className="pitch-footer">{footer}</div>}
    </div>
  );
}
