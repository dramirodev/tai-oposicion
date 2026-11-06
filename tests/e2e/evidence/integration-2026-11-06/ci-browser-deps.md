# CI 42181131603: preparación de navegadores

Ejecución cancelada por el agente para inspección después de más de18min. El log demuestra descarga lenta, no deadlock de TAI. Los artefactos subidos por always contenían evidencia preexistente; QUICK no llegó a ejecutarse.

```text
validate	Run npx playwright install --with-deps chromium webkit	2026-11-06T07:33:19.8961190Z Get:1 file:/etc/apt/apt-mirrors.txt Mirrorlist [144 B]
validate	Run npx playwright install --with-deps chromium webkit	2026-11-06T07:33:19.9568799Z Get:3 http://azure.archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]
validate	Run npx playwright install --with-deps chromium webkit	2026-11-06T07:33:25.9473337Z Need to get 114 MB of archives.
validate	Run npx playwright install --with-deps chromium webkit	2026-11-06T07:33:25.9475197Z Get:1 file:/etc/apt/apt-mirrors.txt Mirrorlist [144 B]
validate	Run npx playwright install --with-deps chromium webkit	2026-11-06T07:33:26.5905351Z Get:2 http://azure.archive.ubuntu.com/ubuntu noble/universe amd64 fonts-ipafont-gothic all 00303-21ubuntu1 [3513 kB]
validate	Run npx playwright install --with-deps chromium webkit	2026-11-06T07:34:44.0059234Z Get:3 http://azure.archive.ubuntu.com/ubuntu noble/main amd64 fonts-freefont-ttf all 20211204+svn4273-2 [5641 kB]
validate	Run npx playwright install --with-deps chromium webkit	2026-11-06T07:50:38.1012653Z Ign:27 http://azure.archive.ubuntu.com/ubuntu noble/universe amd64 librav1e0 amd64 0.7.1-2
validate	Run npx playwright install --with-deps chromium webkit	2026-11-06T07:52:31.7796322Z Get:38 http://azure.archive.ubuntu.com/ubuntu noble/universe amd64 libx264-164 amd64 2:0.164.3108+git31e19f9-1 [604 kB]
validate	Run npx playwright install --with-deps chromium webkit	2026-11-06T07:52:43.5957991Z Get:39 http://azure.archive.ubuntu.com/ubuntu noble/universe amd64 libx265-199 amd64 3.5-2build1 [1226 kB]
validate	Run npx playwright install --with-deps chromium webkit	2026-11-06T07:52:51.0088910Z ##[error]The operation was canceled.
```
