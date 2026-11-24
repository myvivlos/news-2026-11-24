# news-2026-11-24

[![make.fun · news-image-20261124](https://make.fun/badge/news-image-20261124.svg)](https://make.fun/bounty/news-image-20261124?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)
[![rank](https://make.fun/badge/news-image-20261124/myvivlos/news-2026-11-24/rank.svg)](https://make.fun/bounty/news-image-20261124/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)
[![reward](https://make.fun/badge/news-image-20261124/myvivlos/news-2026-11-24/reward.svg)](https://make.fun/bounty/news-image-20261124?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)

A single front page that sums up Tuesday 24 November 2026: twelve numbered regional stories with
their icons and beats, a statistic ticker, a world map whose pins carry the same numbers, a list of
further headlines from the same day, and a date-check box that names the day. `main.ts` hands the
finished 1024x1024 page in as `entry.png`.

## Run it

```bash
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts     # or: node --experimental-strip-types main.ts
```

The program copies `entry.png` from the repository root to the output directory after checking the
PNG signature, the image dimensions (1024x1024) and the 1 MiB cap. It makes no network request and
writes the same bytes on every run.

## Licence

MIT, see `LICENSE`.
