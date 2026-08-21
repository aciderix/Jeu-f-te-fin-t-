# Bibliothèque audio locale

Tous les sons du jeu sont lus depuis ce dossier. Vous pouvez personnaliser le jeu en remplaçant les fichiers `.mp3` ci-dessous **sans changer leur nom**. Les fichiers sont référencés relativement au site, ce qui fonctionne en développement local et sur GitHub Pages.

> Les fichiers actuels sont des copies temporaires de `ambient.mp3` afin que chaque événement pointe déjà vers un vrai fichier. Remplacez-les par vos propres MP3 avant publication pour obtenir des sons distincts.

| Fichier | Déclencheur dans le jeu |
|---|---|
| `ambient.mp3` | Musique d'attente lorsque la partie n'est pas lancée. |
| `suspense.mp3` | Musique pendant la réflexion, lorsque le chronomètre tourne. |
| `new-round.mp3` | Début d'une nouvelle manche. |
| `start.mp3` | Démarrage du jeu. |
| `buzzer.mp3` | Événement de buzzer sur l'écran collectif. |
| `buzz-start.mp3` | Ouverture du buzzer du tie-break pour les équipes concernées, ou réouverture après l'échec d'une équipe concurrente. |
| `validated.mp3` | Validation réussie d'une réponse saisie ou choisie par le chef d'équipe. |
| `correct.mp3` | Révélation d'une bonne réponse, sur l'écran collectif et celui du chef d'équipe concerné. |
| `wrong.mp3` | Mauvaise réponse. |
| `qualified.mp3` | Qualification en fin de phase. |
| `eliminated.mp3` | Élimination en fin de phase. |
| `tie.mp3` | Égalité en fin de phase. |
| `tick.mp3` | Tic du compte à rebours. |
| `timeup.mp3` | Temps écoulé. |
| `victory.mp3` | Victoire finale. |

Les fichiers audio sont préchargés à l’ouverture de l’écran collectif et sont ajoutés au cache de précache de la PWA lors de sa création. Après avoir remplacé un fichier, relancez le build et republiez le site ; sur un appareil où la PWA est déjà installée, ouvrez-la avec une connexion réseau afin que la mise à jour soit téléchargée.
