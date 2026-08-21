from pathlib import Path
import re

path = Path(r"C:\Users\k.harzoune\Documents\Jeu-f-te-fin-t-\src\pages\Display.tsx")
text = path.read_text(encoding="utf-8")

old_block = re.compile(
    r"  // Logique principale de transition et de séquence.*?"
    r"  \}, \[settings\?\.is_playing, settings\?\.question_started_at, settings\?\.show_results, settings\?\.tie_breaker_mode, settings\?\.current_phase, settings\?\.current_round\]\);\r?\n",
    re.DOTALL,
)
new_block = """  // État de secours pour une ancienne partie ne possédant pas encore
  // sequence_state. Les séquences récentes sont rendues directement depuis Supabase.
  useEffect(() => {
    if (!settings || settings.sequence_state) return;

    if (settings.current_phase === 4) {
      setRoundStatus('finale');
    } else if (settings.tie_breaker_mode) {
      setRoundStatus('tie_breaker');
    } else if (settings.show_results) {
      setRoundStatus('reveal');
    } else if (settings.question_started_at) {
      setRoundStatus('active');
    } else {
      setRoundStatus('waiting_start');
    }
  }, [settings?.sequence_state, settings?.current_phase, settings?.tie_breaker_mode, settings?.show_results, settings?.question_started_at]);
"""
text, count = old_block.subn(new_block, text, count=1)
if count != 1:
    raise SystemExit(f"Ancien orchestrateur non trouvé (remplacements={count}).")

text = text.replace("  const [transitionState, setTransitionState] = useState<'none' | 'game_start' | 'phase_intro' | 'round_intro'>('none');\n", "")
text = text.replace("  // Suivi des transitions pour éviter de les rejouer\n  const lastSeenPhaseRef = useRef<number | null>(null);\n  const lastSeenRoundRef = useRef<number | null>(null);\n  const hasPlayedGameStartRef = useRef(false);\n", "")
path.write_text(text, encoding="utf-8")
print("Orchestrateur local remplacé et références supprimées.")
