# Audit d’expérience — écran collectif et déroulé de jeu

## Version auditée : `aa0126d` — 19 août 2026

**Objet.** Cet audit examine la version corrigée du jeu « À qui qu’elle est cette Tête de visage ? », avec une priorité sur l’écran collectif : lisibilité de l’état de jeu, transitions entre chaque moment, animation, son, rythme et cohérence avec les écrans équipe et maître du jeu. Le dépôt a été actualisé au commit `aa0126d`, puis validé par `tsc --noEmit` et une compilation Vite de production réussie. Aucune donnée de jeu n’a été modifiée pendant l’audit. [1]

> **Verdict.** Les correctifs livrés résolvent des problèmes de cohérence importants : choix désormais déterministes, chrono ancré sur une heure de départ partagée, verrouillage effectif à zéro, départage manuel réellement diffusé, contexte d’équipes en départage persisté, et écran de victoire pour une finale conclue au buzzer. Le produit est maintenant **plus fiable fonctionnellement**. En revanche, l’écran collectif reste un très bon écran de question, mais pas encore une véritable **régie de spectacle** : il montre le bon état, sans toujours le mettre en scène ni expliciter suffisamment ce qui vient de se produire et ce qui arrive ensuite.

| Bilan | Évaluation |
|---|---|
| Cohérence des choix sur tous les écrans | **Corrigée** |
| Chrono synchronisé au début et entre manches d’une même phase | **Corrigé** |
| Chrono synchronisé après une élimination sans égalité | **À corriger en priorité** |
| Arrêt des réponses à 0 | **Corrigé côté équipe**, mais le grand écran ne met pas assez en scène le temps écoulé |
| Départage manuel cross-device | **Corrigé** |
| Persistance complète d’un départage après rechargement | **Partielle** |
| Finale sans égalité | **Toujours incomplète** |
| Transitions visuelles, signalétique et sonorisation spectacle | **À renforcer** |

## 1. Correctifs vérifiés et effet réel sur l’expérience

Le nouvel utilitaire de choix utilise un hash de l’identifiant de question et un générateur pseudo-aléatoire déterministe. Le grand écran et les téléphones affichent donc le même ensemble et le même ordre de réponses pour une question donnée, au lieu de mélanger indépendamment les boutons sur chaque client. C’est un correctif fondamental de lisibilité et de confiance : l’animateur peut désormais commenter le choix « en haut à droite » sans créer d’ambiguïté. [2]

Le nouveau champ `question_started_at` permet à l’écran collectif et aux équipes de recalculer le temps restant à partir de l’heure de départ. Un écran qui arrive tard ou se recharge au milieu d’une manche rejoint donc, dans les cas normaux, le bon instant du compte à rebours. Les équipes désactivent maintenant les choix et la saisie lorsque le temps atteint zéro. [3] [4] [5]

Le départage manuel n’est plus seulement une modale locale : il active le mode partagé, enregistre les équipes concernées, envoie l’événement de démarrage et rend le buzzer disponible sur les téléphones. L’écran collectif reçoit les équipes en ballotage et met à jour les badges associés. [4] [5]

La résolution d’une finale avec égalité passe désormais en phase 4. L’écran collectif présente alors une scène de victoire jaune/orange, avec trophée, équipe gagnante et score ; l’équipe gagnante voit aussi son écran de victoire. [3] [4]

## 2. Cartographie de l’écran collectif actuel

| État partagé | Ce que le public voit actuellement | Animation / audio présents | Manque principal |
|---|---|---|---|
| Attente | Logo, fond rayonnant, « Préparez-vous… », bouton son | Logo qui respire/oscille ; halos tournant 40 s ; audio de fond si activé | Aucune information de préparation ou de disponibilité des équipes |
| Nouvelle manche 1/2 | Quatre scores, photo encadrée, choix et barre de temps | Photo en entrée élastique 0,5 s ; choix qui montent | Pas de carton « Manche / phase / consigne », ni compte à rebours chiffré |
| Manche 3 | Quatre scores, photo, barre de temps | Même entrée photo | Pas de consigne collective « Qui est-ce ? » ; bas d’écran presque vide |
| Dernières secondes | Barre jaune puis rouge, légère pulsation sous 25 % | Pulsation de barre | Pas de seuil 10/5/3 s, pas de décompte visible/sonore, pas de message d’urgence |
| Temps à zéro | Barre vide ; la régie doit encore révéler | Aucun événement dédié | Pas de « Temps écoulé », pas de verrouillage explicitement narré au public |
| Révélation 1/2 | Bonne proposition verte et agrandie ; autres grisées | Transition de classes 0,5 s | Pas de jingle de réponse, de checkmark, d’explication, de points qui s’animent |
| Révélation 3 | Voile noir et bonne réponse en texte | Fondu simple | Pas de transition d’impact, de rappel de la photo ou du résultat au tableau |
| Fin de phase | Dernier écran de question reste affiché tant que le maître décide | Aucun événement collectif dédié | Le public ne sait ni qu’une phase est terminée ni qui est éliminé/qualifié |
| Départage prêt | Photo bonus, scores, badges « Ballotée », bandeau buzzer | Entrée de photo ; emoji qui rebondissent | Départage ne porte ni numéro de question bonus ni nombre de places restant à pourvoir |
| Buzzer pris | Équipe mise en avant, bandeau nominatif | Badge rebondissant ; son buzzer si l’audio Web est autorisé | Moment encore peu spectaculaire ; pas de gel visuel global ni de chronologie de jugement |
| Mauvaise réponse au buzzer | Toast rouge 4 s | Son grave ; toast entrant | Texte trop fugace et pas de statut durable par équipe sur le grand écran |
| Finale phase 4 | Trophée, « Grande victoire », nom et score | Entrée en spring | Aucun jingle de victoire, confettis contrôlés, tableau final complet, ni appel au reset / prochaine partie |

Cette cartographie montre une constante : l’application a les **bons états métier**, mais une partie des changements de statut est visible seulement dans le pupitre maître ou sur les téléphones. Le grand écran devrait, lui, raconter la progression à tous les spectateurs. [3] [4]

## 3. Constats prioritaires

### P0 — corriger avant toute évolution de mise en scène

| ID | Constat et preuve | Effet sur le jeu | Correctif recommandé | Critère d’acceptation |
|---|---|---|---|---|
| P0-1 | Après une fin de phase sans égalité, `current_round`, `current_phase` et `show_results` sont mis à jour, mais **pas** `question_started_at`. Le correctif de chrono retombe alors sur des compteurs locaux après passage phase 1 → 2 ou 2 → 3. [4] | Les téléphones et le grand écran peuvent à nouveau démarrer à des instants différents après une élimination normale. | Ajouter `question_started_at: new Date().toISOString()` dans `handleConfirmNextPhaseWithoutTie`; idéalement centraliser toute ouverture de question dans une seule fonction. | Après élimination sans égalité, deux écrans ouverts à des instants différents affichent le même temps à ± 0,2 s. |
| P0-2 | Une finale **sans égalité** conserve `current_phase = 3`. Le bouton « Terminer la partie » de la modale ferme seulement celle-ci ; il ne déclenche pas la phase 4. [4] [6] | Une victoire régulière n’obtient pas l’écran final que reçoit une victoire au buzzer. Le traitement est asymétrique. | Dans la confirmation de fin de phase 3 sans égalité, écrire une résolution finale explicite : identifier et persister le vainqueur, puis positionner `current_phase = 4`. | Finale sans égalité et finale au buzzer aboutissent toutes deux à l’écran de victoire collectif. |
| P0-3 | `tie_breaker_question_id` est persisté, mais l’écran collectif et le maître ne le relisent pas pour hydrater la question active. Ils repartent sur la première question bonus en cas de rechargement. Les listes « sauvées », « refusées » et le nombre de places restant ne sont pas persistés. [3] [4] | En cas de rafraîchissement ou de panne d’un écran pendant une mort subite, l’état visuel et l’arbitrage peuvent diverger du jeu réel. | Persister un objet de session de départage : `question_id`, `tied_team_ids`, `saved_team_ids`, `failed_team_ids`, `target_spots`, `status`, et le relire dans tous les clients. | Un rechargement de l’écran collectif, du maître ou d’une équipe restitue exactement la même photo, les mêmes équipes verrouillées et les mêmes places restantes. |
| P0-4 | Le bouton audio n’active/pause que les deux pistes `<audio>`. Les effets synthétisés du buzzer, de l’erreur et de la validation restent indépendants : « Son OFF » peut donc laisser jouer des FX. De plus, un navigateur peut bloquer le premier `AudioContext` déclenché par un broadcast sans geste utilisateur. [3] [7] | Contrôle sonore trompeur, effets parfois absents sur le projecteur, absence de maîtrise des niveaux. | Créer un `AudioManager` unique avec déverrouillage sur le bouton Son, bus `music`, `fx` et `master`, volumes persistés et respect de l’état muet pour tous les sons. | Avec Son OFF, aucun son d’ambiance ni FX ne sort. Avec Son ON, le premier buzzer distant est audible sur un navigateur neuf. |

### P1 — gains majeurs de clarté et de tension sur l’écran collectif

| ID | Manque observé | Recommandation précise | Bénéfice |
|---|---|---|---|
| P1-1 | Aucune signature de manche ou de phase sur le grand écran. | Ajouter en tête centrale `MANCHE 3 / 6`, `PHASE 2 — 4 PROPOSITIONS` et une consigne courte : `Qui est-ce ?`, `Choisissez parmi les 4 réponses`, ou `Réponse libre sur les téléphones`. | Le public comprend immédiatement la règle du moment et l’avancée dans la soirée. |
| P1-2 | Le temps n’existe que comme barre sans chiffre. À 0, aucun état collectif explicite n’est affiché. | Afficher `00:30` → `00:00` en texte très large près de la barre ; déclencher un écran/fuseau `TEMPS ÉCOULÉ` et geler visuellement les choix avant l’étape de révélation. | Lisibilité à distance, urgence partagée, réduction des contestations sur la fermeture des réponses. |
| P1-3 | Le lancement de question démarre la course sans prélude. La photo et les choix apparaissent alors que le chrono est déjà actif. | Introduire un sous-état de 1,0–1,5 s : carton `NOUVELLE MANCHE`, entrée de photo, apparition échelonnée des choix, puis écriture de `question_started_at` au top. | Évite de « perdre » les premières secondes ; rend la séquence digne d’un jeu télévisé. |
| P1-4 | La révélation est purement chromatique : vert/gris ou voile texte. | Créer une chorégraphie en trois temps : gel à 0,2 s ; désaturation des mauvaises réponses ; mise en avant de la bonne avec `✓ BONNE RÉPONSE`, son court et delta de score. | Le public identifie sans délai la réponse juste et la conséquence. |
| P1-5 | Les scores changent sans événement visible. | À la réception de chaque nouveau score, animer le chiffre en count-up et afficher temporairement `+1` près de l’équipe concernée ; animer un liseré de progression discret. | Rend le score lisible, gratifiant et commentable par l’animateur. |
| P1-6 | La fin de phase ne donne pas de signal collectif. | Ajouter un interstitiel plein écran de 2–3 s : `FIN DE PHASE`, tableau de classement, équipe éliminée ou équipes en mort subite, puis écran de transition phase suivante. | Évite les silences et donne une clôture nette à chaque acte. |
| P1-7 | Le départage renseigne les équipes ballotées mais pas l’enjeu exact. | Afficher `DÉPARTAGE — 1 PLACE À PRENDRE`, `QUESTION BONUS 2/5`, badges persistants `sauvée`, `verrouillée`, `en attente`, et une ligne `X équipes encore en lice`. | Les spectateurs peuvent suivre la logique sans écouter le maître. |
| P1-8 | La phase 3 laisse le bas de l’écran presque vide et n’affiche pas de consigne. | Remplacer la zone de propositions par un bandeau : `QUI EST-CE ?` / `Répondez sur votre écran` et un compteur de réponses reçues non nominatif, par exemple `3 / 4 réponses enregistrées`. | Utilise l’espace, oriente les équipes et maintient le rythme. |
| P1-9 | Les images sont forcées en `object-cover`. Une tête peut être fortement coupée ; les erreurs de chargement ne sont pas gérées. | Pour les portraits, préférer `object-contain` avec fond de scène ou stocker `focal_point`; précharger l’image suivante et gérer `onError` avec un état « image indisponible ». | Évite de dégrader le cœur du jeu : la reconnaissance visuelle. |
| P1-10 | Le compteur est recalculé avec l’horloge locale de chaque navigateur. | Conserver `question_started_at`, mais synchroniser périodiquement l’écart à une heure serveur ou calculer un `expires_at` validé par le backend ; afficher le même état fermé pour tous. | Réduit les écarts de temps sur appareils mal réglés ou fortement dérivants. |

### P2 — raffinement, accessibilité et exploitation

| ID | Recommandation | Intérêt |
|---|---|---|
| P2-1 | Créer un mode « spectacle réduit » : réduire les halos, pulsations, rebonds, spins et springs si `prefers-reduced-motion` est actif, avec un contrôle visible dans l’écran collectif. | Les animations actuelles dépassent cinq secondes et coexistent avec des informations importantes. Le W3C recommande un mécanisme pour contrôler les contenus mobiles/clignotants/auto-mis à jour non essentiels. [8] |
| P2-2 | Prévoir un mode contraste renforcé et vérifier les contrastes réels des textes pâles sur fonds translucides. | Le jeu est vu de loin, parfois dans une salle très éclairée ; la lisibilité est plus importante que le style glassmorphism. |
| P2-3 | Ajouter des libellés textuels aux signaux de couleur : `✓ Bonne réponse`, `✕ Mauvaise réponse`, `+1`, `Équipe éliminée`. | Les seuls codes vert/gris et le son ne doivent pas porter une information critique. |
| P2-4 | Ajouter des cue visuels synchronisés à tous les sons : icône de buzzer, bandeau « top départ », pictogramme temps écoulé, sous-titre d’annonce finale. | Les informations clés doivent rester comprises sans l’audio de salle. |
| P2-5 | Créer un panneau audio collectif : activé, volume musique, volume effets, test de son, muet ; mémoriser ce choix localement. | Les recommandations WCAG demandent un mécanisme pour contrôler tout audio automatique de plus de trois secondes ; le démarrage après action volontaire est préférable. [10] |
| P2-6 | Compresser le logo 1536×1024, servir les photos dans des formats modernes et fractionner le bundle (`679 kB` minifié, avertissement de build). | L’écran d’attente doit arriver vite ; un retard à l’ouverture réduit la qualité perçue de la régie. |
| P2-7 | Ajouter un état de connexion discret pour le grand écran : `Synchronisé`, `Reconnexion…`, puis un écran de secours non ambigu si les données ne se chargent pas. | Aujourd’hui l’absence de `settings` conduit visuellement à l’écran d’attente, ce qui peut masquer une panne. |
| P2-8 | Ajouter une vraie page d’instruction brève avant le lancement : ordre des phases, règle du chrono, explication du buzzer et de la mort subite. | Permet de réduire les explications verbales et les hésitations pendant la soirée. |

## 4. Chorégraphie cible recommandée

Le jeu gagnerait à traiter chaque manche comme une petite séquence télévisée contrôlée, plutôt que comme un rendu React qui change directement de propriétés. Les durées ci-dessous sont des cibles de design : elles n’allongent pas nécessairement le temps utile de jeu car le chrono commence seulement au « top ».

| Moment | Durée cible | Image collective | Son | Données / déclencheur |
|---|---:|---|---|---|
| Pré-manche | 1,2 s | Carton `MANCHE 3 / 6`, phase et consigne ; scores présents mais atténués | Stinger très court ou silence assumé | Maître demande une nouvelle manche |
| Mise en place | 0,5 s | Photo cadre doré entre en léger zoom ; fond parallax lent | Montée de tension légère | Image préchargée, choix invisibles |
| Top départ | 0,3 s | Les choix montent en cascade ; chrono `00:30` devient actif | « Top » bref, distinct du buzzer | Écrire `question_started_at` à cet instant |
| Jeu normal | 30 s ou durée configurée | Photo stable ; choix lisibles ; barre + chiffre ; `3/4 réponses` facultatif | Boucle suspense à bas niveau | Actualiser le compteur partagé sans identifier les équipes si souhaité |
| Seuil 10 s | 0–10 s | Chrono ambré, pulsation douce | Un tick toutes les 2 s au maximum | Basé sur temps restant |
| Seuil 5 s | 0–5 s | Chrono rouge, chiffre plus grand | Tick régulier discret | Basé sur temps restant |
| Temps écoulé | 0,8 s puis attente | `TEMPS ÉCOULÉ` ; choix gelés, désaturés ; photo reste visible | Hit court / coupure de suspense | `timeLeft = 0` côté public ; réponses déjà verrouillées |
| Révélation | 1,4 s | Mauvaises réponses s’effacent, bonne réponse gagne cadre/check ; score `+1` | Sting correct puis micro-applaudissement optionnel | Maître valide `show_results` |
| Fin de phase | 2–3 s | Classement, élimination/qualification, annonce de la phase suivante ou mort subite | Sting d’élimination ou montée dramatique | Maître confirme la transition |
| Finale | 4–6 s | Classement final, confettis modérés, trophée, gagnant et score | Fanfare courte puis musique de victoire | Écriture persistante du vainqueur / phase 4 |

Il faut éviter que le « top », la minuterie, les réponses et la révélation s’empilent sans respiration. Une structure `intro → top → jeu → arrêt → révélation → conséquence` donne à l’animateur de l’espace pour parler et aux spectateurs le temps de comprendre.

## 5. Plan sonore recommandé

L’actuel design sonore est volontairement minimal : un buzzer descendant, un accord de validation et un son grave de rejet. C’est sain comme socle, mais il ne couvre pas les événements dramaturgiques principaux. [7]

| Événement | Son recommandé | Rôle | Garde-fou |
|---|---|---|---|
| Ambiance attente | Jingle / boucle calme | Installer l’univers | Musique désactivée par défaut ou activée volontairement ; volume réglable |
| Nouvelle manche | Stinger de 0,4–0,7 s | Marquer le changement de séquence | Pas à chaque micro-transition |
| Top départ | Hit net de 150–250 ms | Synchroniser les joueurs | Doit être distinct du buzzer |
| 10 dernières secondes | Tick discret, sparse | Créer la tension | Maximum un signal toutes les 2 s |
| 5 dernières secondes | Tick plus affirmé | Faire sentir l’urgence | Couper dès l’expiration ; jamais agressif |
| Temps écoulé | Hit final / coupure | Fermer sans ambiguïté la fenêtre de réponse | Toujours doublé de `TEMPS ÉCOULÉ` visuel |
| Révélation correcte | Sting majeur 0,6–0,9 s | Récompenser et clarifier | Une seule fois par révélation, pas par équipe |
| Fin de phase | Sting court selon qualification / élimination | Marquer le changement d’acte | Laisser le maître parler après le sting |
| Buzzer | Son actuel amélioré ou conservé | Identifier le premier joueur | Accessible via le mixeur FX ; aucun son si muet |
| Victoire | Fanfare 2–4 s, puis boucle douce | Célébrer la conclusion | Réduction du volume de fond lors du speech animateur |

Les signaux essentiels doivent avoir un équivalent visuel. Cela est particulièrement important dans une salle bruyante ou pour les personnes qui ne perçoivent pas les sons. Le W3C indique par ailleurs qu’un contenu audio automatique de plus de trois secondes doit être arrêtable ou contrôlable indépendamment du volume général. [10]

## 6. Information à ajouter au grand écran

Le public doit pouvoir comprendre l’état du jeu en trois secondes, sans regarder le maître du jeu ni un téléphone. L’écran collectif devrait porter le noyau d’information ci-dessous.

| Zone | Aujourd’hui | Cible |
|---|---|---|
| Bandeau supérieur | Noms et scores | Noms, scores, rang discret, animation `+1`, statut éliminé/balloté/sauvé |
| Titre central haut | Absent | `MANCHE 3 / 6` ; `PHASE 2 — 4 PROPOSITIONS` ; consigne |
| Cadre photo | Photo seule | Photo préchargée ; état d’erreur ; traitement portrait non recadré ; légère profondeur |
| Chrono | Barre seule | Barre, valeur numérique, seuils 10/5/0, état temps écoulé |
| Bas d’écran phase 1/2 | Choix | Choix + repères de lecture stables si souhaité, puis révélation textuelle `✓ BONNE RÉPONSE` |
| Bas d’écran phase 3 | Vide | `QUI EST-CE ?` ; `Répondez maintenant sur vos écrans` ; compteur non nominatif de réponses |
| Fin de phase | Rien avant l’action maître | Classement, message d’élimination/qualification ou annonce de mort subite |
| Départage | Bandeau générique | Places en jeu, bonus courant, équipes en lice, statuts persistants |
| Finale | Nom et score du gagnant | Podium / classement final, points, appel à applaudir, possibilités de redémarrage réservées au maître |

## 7. Accessibilité et confort de vision

Les animations de fond tournent en continu, le logo respire indéfiniment, plusieurs éléments pulsents ou rebondissent et certaines informations temporaires disparaissent après quatre secondes. Ces choix ne sont pas intrinsèquement inadaptés à un jeu, mais ils doivent être contrôlables lorsqu’ils coexistent avec des informations à lire. Le W3C recommande une possibilité de pause, arrêt ou masquage des contenus mobiles, clignotants ou auto-mis à jour non essentiels présentés en parallèle. [8]

Le chronomètre est un mécanisme de compétition qui peut être assumé comme essentiel, mais le jeu doit tout de même le communiquer clairement avant la manche et annoncer son expiration. Dans les contextes où l’équité autorise une alternative, les recommandations W3C prévoient de pouvoir désactiver, ajuster ou prolonger une limite de temps ; une option « mode détente / accessible » sans chrono ferait du jeu une expérience plus inclusive hors compétition. [9]

Les actions recommandées sont : respecter `prefers-reduced-motion`, proposer une bascule « animations réduites », éviter les flashs rapides et les grandes alternances de rouge saturé, expliciter le vert/gris par du texte et un pictogramme, vérifier les contrastes sur projecteur, et ne jamais faire dépendre une information essentielle du son seul. [8] [9] [10]

## 8. Backlog proposé

| Lot | Contenu | Priorité | Dépendances |
|---|---|---|---|
| 1. Cohérence d’état | Corriger `question_started_at` à chaque ouverture, finir la finale normale, persister toute la session de départage | P0 | Migration Supabase complémentaire |
| 2. Moteur de transitions | Introduire les sous-états `intro`, `active`, `time_up`, `reveal`, `phase_summary`, `finale`; ne plus dériver toute l’UI de quatre booléens | P1 | Lot 1 conseillé |
| 3. HUD collectif | Manche/phase, consigne, chrono chiffré, réponses reçues, place de départage, score delta | P1 | Moteur de transitions |
| 4. Révélation et fin de phase | Check textualisé, score animé, tableau de qualification, interstitiels | P1 | HUD et événements de score |
| 5. Audio manager | Déverrouillage, mixeur, volumes, FX cohérents, time-up/top/finale | P0 puis P1 | Lot 1 pour l’état global |
| 6. Résilience média | Préchargement, états de chargement/erreur image, `object-contain`/focal point | P1 | Aucun |
| 7. Accessibilité spectacle | Reduced motion, contrôle animation, contraste, alternatives de texte | P2 | Aucun |
| 8. Performance | Images modernes, code-splitting, contrôle sur réseau lent | P2 | Aucun |

## 9. Plan de recette à exécuter avant une soirée

| Scénario | Résultat attendu |
|---|---|
| Démarrage avec trois écrans ouverts à des instants différents | Même question, même ordre de choix, même chrono à ± 0,2 s |
| Passage de phase sans égalité | La première question de la phase suivante part avec un chrono partagé, pas un chrono local |
| Temps à zéro | Tous les téléphones affichent/ressentent le verrouillage ; le collectif affiche explicitement `Temps écoulé` |
| Révélation phases 1, 2 et 3 | Réponse correcte, explication/label, score et transition lisibles à 5 m de distance |
| Égalité puis rechargement du grand écran | Même question bonus, même statut de chaque équipe, mêmes places restantes |
| Départage manuel | Toutes les équipes concernées obtiennent le bouton buzzer ; les autres voient le statut qualifié/attente |
| Finale sans égalité | La phase 4 s’affiche avec le bon vainqueur et un classement final cohérent |
| Finale avec égalité | Validation au buzzer mène au même écran de phase 4 |
| Son OFF | Zéro ambiance et zéro FX ; Son ON rend le premier buzzer distant audible |
| Vidéo/image lente ou inaccessible | Le public voit un état de repli esthétique et l’animateur est alerté sans casser la partie |
| Mode animations réduites | Les éléments restent lisibles, les informations ne clignotent pas et le rythme de jeu demeure clair |

## Références

[1]: https://github.com/aciderix/Jeu-f-te-fin-t-/commit/aa0126d "Commit aa0126d — deterministic choices and tie-breaker sync"
[2]: https://github.com/aciderix/Jeu-f-te-fin-t-/blob/aa0126d/src/lib/utils.ts "Choix déterministes"
[3]: https://github.com/aciderix/Jeu-f-te-fin-t-/blob/aa0126d/src/pages/Display.tsx "Écran collectif corrigé"
[4]: https://github.com/aciderix/Jeu-f-te-fin-t-/blob/aa0126d/src/pages/GameMaster.tsx "Orchestration, chrono et départage"
[5]: https://github.com/aciderix/Jeu-f-te-fin-t-/blob/aa0126d/src/components/team/TeamDashboard.tsx "Parcours équipe et verrouillage au temps écoulé"
[6]: https://github.com/aciderix/Jeu-f-te-fin-t-/blob/aa0126d/src/components/gamemaster/PhaseEndModal.tsx "Modal de fin de phase"
[7]: https://github.com/aciderix/Jeu-f-te-fin-t-/blob/aa0126d/src/lib/soundEffects.ts "Effets sonores existants"
[8]: https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html "W3C WCAG 2.2.2 — Pause, Stop, Hide"
[9]: https://www.w3.org/WAI/WCAG21/Understanding/timing-adjustable.html "W3C WCAG 2.2.1 — Timing Adjustable"
[10]: https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html "W3C WCAG 1.4.2 — Audio Control"
