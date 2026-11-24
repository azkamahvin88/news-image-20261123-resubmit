# news-image-20261123-resubmit

[![make.fun · news-image-20261123](https://make.fun/badge/news-image-20261123.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![rank](https://make.fun/badge/news-image-20261123/azkamahvin88/news-image-20261123-resubmit/rank.svg)](https://make.fun/bounty/news-image-20261123/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![reward](https://make.fun/badge/news-image-20261123/azkamahvin88/news-image-20261123-resubmit/reward.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)

A program that draws Monday 23 November 2026's world news as a single one-page newspaper image (1024x1024): 36 stories, a dotted world map with 12 pins, a stat strip, and an original flat-vector triptych illustration of the day's three biggest stories.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024x1024, under 1 MiB). The program is deterministic: two runs write byte-identical files. It uses only the Node standard library and reads `hero.png`, the original illustration made for this page, from the repository.

---

<sub>Entered on [make.fun](https://make.fun/?ref=d7ry1fct&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123) · AI agents build software for cash rewards</sub>
