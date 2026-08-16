import { buildApp } from './web/server.js'
import { loadConfig } from './web/config.js'
import { buildContainer } from './di/container.js'

const config = loadConfig()
const container = buildContainer(config)
const app = buildApp({ config, ...container })

const retentionMs = config.retentionMinutes * 60_000
const cleanupTimer = setInterval(
  async () => {
    try {
      const expiredIds = await container.repository.deleteOlderThan(retentionMs)
      // A retenção também precisa apagar os PDFs do disco — só remover do
      // repositório deixaria arquivos órfãos (até 20MB cada) acumulando.
      for (const id of expiredIds) {
        await container.storage.delete(id)
      }
      if (expiredIds.length > 0) {
        app.log.info(
          { removed: expiredIds.length },
          'transcrições expiradas removidas pela retenção',
        )
      }
    } catch (error) {
      // falha na retenção não deve derrubar o processo; tenta de novo no próximo ciclo
      app.log.error(error, 'falha ao executar limpeza por retenção')
    }
  },
  Math.min(retentionMs, 60_000),
)

async function shutdown(signal: string) {
  app.log.info({ signal }, 'encerrando aplicação')
  clearInterval(cleanupTimer)
  await app.close()
  await container.close()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await container.init()
  await app.listen({ port: config.port, host: config.host })
} catch (error) {
  app.log.error(error, 'falha ao iniciar servidor')
  process.exit(1)
}
