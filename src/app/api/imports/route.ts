import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { ImportService } from '@/server/services/importService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const batches = await ImportService.listBatches(user.id)
    return ok(batches, 'Importações recuperadas.')
  } catch (error) {
    return apiError(error, 'Erro ao listar importações.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const form = await request.formData()
    const file = form.get('file')
    if (!file || typeof file === 'string') {
      return err('Envie um arquivo de extrato (.ofx ou .pdf).', 400)
    }

    const name = file.name.toLowerCase()
    if (name.endsWith('.ofx')) {
      const ofxText = await file.text()
      const result = await ImportService.createImport({
        userId: user.id,
        source: file.name,
        format: 'ofx',
        ofxText,
      })
      return ok(result, 'Extrato OFX processado.', 201)
    }

    if (name.endsWith('.pdf')) {
      const pdfBuffer = await file.arrayBuffer()
      const result = await ImportService.createImport({
        userId: user.id,
        source: file.name,
        format: 'pdf',
        pdfBuffer,
      })
      return ok(result, 'Extrato PDF processado.', 201)
    }

    return err('Formato não suportado. Use .ofx ou .pdf.', 400)
  } catch (error) {
    return apiError(error, 'Erro ao processar o extrato.')
  }
}
