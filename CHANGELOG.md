# Changelog

## [1.2.1](https://github.com/lukyanzhukov/ai-for-developers-project-386/compare/v1.2.0...v1.2.1) (2026-11-14)

### Bug Fixes

- **ci:** одна задача OSV на пакет вместо потока advisories ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([03c9b64](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/03c9b64f25caccd72957b19d99a70f163b29d843))
- consolidate OSV alerts by package version ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([60ba0d7](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/60ba0d7c064dd7aa93476917f6422d100a3893ea))

## [1.2.0](https://github.com/lukyanzhukov/ai-for-developers-project-386/compare/v1.1.0...v1.2.0) (2026-11-14)

### Features

- add independent scheduled source and lockfile audits ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([2a7c81b](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/2a7c81b172fb6bc8c806b40b3e5f0a25da8f94d6))
- **ci:** независимые аудиты TODO/FIXME и lockfile ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([1e0d7d0](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/1e0d7d053556ff688ecb9fb025f357184e2383d4))

### Bug Fixes

- allow manual free audit model selection ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([12a1d12](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/12a1d120c9b60967ce33f549e664dddb46ed9a49))
- **ci:** bound PR review context and pin helper model ([#29](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/29)) ([9a132ec](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/9a132ec8015e95614aaa269a8f47c596a6586da9))
- **ci:** cap review iterations and disable web tools ([#29](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/29)) ([f66b94c](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/f66b94c590ceb9491ed1809f6e90c4c7d1987cef))
- **ci:** keep expiry exercise independent of model quota ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([81f191f](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/81f191fb2f6e024a7903bd94e44f2d6e2c68675b))
- **ci:** pin free helper model in all OpenCode workflows ([#30](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/30)) ([1b35815](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/1b3581581962a9f6e310b2a18786423842f3acb8))
- **ci:** preserve safe tool approvals for free-model compatibility ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([b9261a3](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/b9261a30b47b228091b108a31e6adcea4e011f2b))
- **ci:** диагностика и завершение зависших агентов аудита ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([1a8edd5](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/1a8edd5f27db3c4e51849bd9d91c67c02d3d0be1))
- **ci:** совместимость бесплатных моделей с read-only аудитами ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([9592415](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/9592415856b00216018b083cdccc3cc5bc71e726))
- preserve audit evidence and replay provenance ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([fb6151d](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/fb6151dc0fd9616fd33f768db1981e597e76d56b))
- stop audit agents on provider errors ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([0a71fd1](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/0a71fd1c2bccaabdae6389d23bf41d64284cb38b))
- **test:** isolate audit fixtures from hook Git environment ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([1c85ccf](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/1c85ccff7edc9a7fbb5a17fab279d93be77e1de7))
- **test:** изолировать Git-окружение тестов аудита ([#32](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/32)) ([17860c6](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/17860c6b2ac288418f699e032292632e8b25fb9b))

## [1.1.0](https://github.com/lukyanzhukov/ai-for-developers-project-386/compare/v1.0.0...v1.1.0) (2026-11-09)

### Features

- полный список встреч владельца ([#20](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/20)) ([#21](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/21)) ([b6db0ee](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/b6db0ee3dac7607c232f830ae0d8ec8474b7677a))

### Bug Fixes

- проверять список перед календарём при деплое ([#23](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/23)) ([#24](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/24)) ([f9b70f8](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/f9b70f82ebb0d688aacc87d78d96ff1a5962a6e6))

## 1.0.0 (2026-11-08)

### Features

- **api:** record approved booking contract ([#9](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/9)) ([b3bd275](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/b3bd27597d87de27970f4f6db21f4ab5d11897ed))
- **booking:** confirm conflict-safe bookings ([#13](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/13)) ([844f117](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/844f117a90ae8cf312fcdb09dcc44d5952ee3495))
- **booking:** create and publish meeting types ([#11](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/11)) ([1c11451](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/1c11451821bd2db6fb465bb5b94e59239e89cd01))
- **booking:** implement end-to-end booking ([#9](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/9)) ([699f4ff](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/699f4ff378d4e2911566777c5ad16fa548af43c5))
- **booking:** integrate availability calendar ([#12](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/12)) ([2f14a4b](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/2f14a4b8745d79edf95816d42111375dfac3fd0e))
- **booking:** integrate conflict-safe confirmation ([#13](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/13)) ([948008e](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/948008ee28a90bb6c7227eff1e47bc8a244d7af6))
- **booking:** integrate meeting type creation ([#11](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/11)) ([c48928a](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/c48928a6a9dc8b4ffcce0f74c9f9031e1c8e8c69))
- **booking:** integrate meeting type listing ([#10](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/10)) ([edca1cb](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/edca1cb31aadefb1f719c8f93e7f495d31077fc3))
- **booking:** integrate upcoming owner meetings ([#14](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/14)) ([a2d2045](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/a2d204517d5cf5797fd9e1cbd1cde1cd7520ebf8))
- **booking:** list meeting types through generated SDK ([#10](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/10)) ([8d178fb](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/8d178fb3a0369e60ef788ab8e451c168354b4c10))
- **booking:** show availability calendar ([#12](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/12)) ([985314e](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/985314efe695fe49faffb44a967106c67a93b13b))
- **booking:** show upcoming owner meetings ([#14](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/14)) ([d8919f3](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/d8919f3ef60628406d5d44f2057645bfad1088b6))
- **deploy:** package application for Docker and Render ([8fcc5dc](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/8fcc5dc4201936e469c77d206285b42759c46dd0))
- merge production deployment and accepted UI ([#19](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/19)) ([bddd4bf](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/bddd4bfc37daeee3f3cd19a0849ce619a99f12ab))
- production Docker deployment and accepted booking UI ([bddd4bf](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/bddd4bfc37daeee3f3cd19a0849ce619a99f12ab))
- **web:** add booking wizard and owner calendar ([#14](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/14)) ([329c4ff](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/329c4fffc2a2ff7cb81d0761a81788fcda8d0ead))
- **web:** add landing page and booking placeholder ([4eafa30](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/4eafa309c80ee99a1d7a8adf969028ad3a7a8a18))

### Bug Fixes

- **booking:** integrate review corrections ([#9](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/9)) ([a2180c6](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/a2180c6024a13afbadef4bf7423b68611aa63c77))
- **booking:** preserve owner draft on list navigation ([#9](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/9)) ([5dbd9f6](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/5dbd9f6ca350606112a4fa8dce50d785419456ad))
- preserve booking scenario state after review ([#9](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/9)) ([b391c75](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/b391c75d06cfae517b9e03448f4834fe0f80f9df))
- preserve draft when opening public meeting types ([#9](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/9)) ([85f56e6](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/85f56e658b75a82333c402036a05d1b42e6b8c81))
- **web:** keep time selection border inside scroll area ([#12](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/12)) ([6f1a98c](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/6f1a98cf661b32b2b3d34dd6acfd8beafa53e879))
- **web:** redesign booking flow and owner forms ([#12](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/12)) ([cd84f8e](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/cd84f8e6648c1fa3795c90c73b2063bfd0e7f269))
- **web:** remove redundant wizard step captions ([#12](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/12)) ([b0873fc](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/b0873fc18da3b65f453da487bc86ab518c4fc317))
- **web:** retain selected date border on hover ([#12](https://github.com/lukyanzhukov/ai-for-developers-project-386/issues/12)) ([8a23078](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/8a23078457aa5c698581799d8d566a2041787512))

### Reverts

- **web:** restore previous wizard step styling ([f25536e](https://github.com/lukyanzhukov/ai-for-developers-project-386/commit/f25536e9f066e345f69efd8d3617995fec410389))
