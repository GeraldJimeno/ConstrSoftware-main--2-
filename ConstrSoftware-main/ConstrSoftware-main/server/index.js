const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')
const PDFDocument = require('pdfkit')
require('dotenv').config()

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  FRONTEND_URL,
  PORT = 4000,
} = process.env

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables.')
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const app = express()

const allowedOrigins = (FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)
const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177']

app.use(
  cors({
    origin: (origin, callback) => {
      const list = allowedOrigins.length ? allowedOrigins : defaultOrigins
      if (!origin || list.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error('CORS not allowed for this origin'))
    },
  }),
)
app.use(express.json())

// Common select list for samples
const SAMPLE_SELECT = `
  id, code, type, origin, transport_condition, storage_condition,
  business_name, phone, address, status, received_at, created_at,
  assigned_analyst_id, due_date,
  analysis_payload, analysis_submitted_at,
  validation_payload, validation_submitted_at,
  evaluated_by, created_by, certification_status
`

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

const requireAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.', token_parts: 0 })
  }

  let tokenClaims = null
  try {
    const payload = token.split('.')[1]
    if (payload) {
      const decoded = Buffer.from(payload, 'base64').toString('utf8')
      tokenClaims = JSON.parse(decoded)
    }
  } catch {
    tokenClaims = null
  }

  const expectedIss = `${SUPABASE_URL}/auth/v1`
  if (!tokenClaims?.sub || tokenClaims?.iss !== expectedIss) {
    return res.status(401).json({
      error: 'Invalid session.',
      detail: 'Token claims invalid.',
      token_parts: token.split('.').length,
      token_prefix: token.slice(0, 10),
      token_role: tokenClaims?.role || null,
      token_sub: tokenClaims?.sub || null,
      token_iss: tokenClaims?.iss || null,
    })
  }

  const { data: adminUser, error: adminUserError } = await supabaseAdmin.auth.admin.getUserById(
    tokenClaims.sub,
  )
  if (adminUserError || !adminUser?.user) {
    return res.status(401).json({
      error: 'Invalid session.',
      detail: adminUserError?.message || 'User not found.',
      token_parts: token.split('.').length,
      token_prefix: token.slice(0, 10),
      token_role: tokenClaims?.role || null,
      token_sub: tokenClaims?.sub || null,
      token_iss: tokenClaims?.iss || null,
    })
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role_id, roles:roles(slug)')
    .eq('id', adminUser.user.id)
    .single()

  if (profileError || profile?.roles?.slug !== 'admin') {
    return res.status(403).json({ error: 'Forbidden.' })
  }

  req.user = adminUser.user
  next()
}

// Generic auth guard for any authenticated user
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' })
  }

  let tokenClaims = null
  try {
    const payload = token.split('.')[1]
    if (payload) {
      const decoded = Buffer.from(payload, 'base64').toString('utf8')
      tokenClaims = JSON.parse(decoded)
    }
  } catch {
    tokenClaims = null
  }

  const expectedIss = `${SUPABASE_URL}/auth/v1`
  if (!tokenClaims?.sub || tokenClaims?.iss !== expectedIss) {
    return res.status(401).json({ error: 'Invalid session.' })
  }

  const { data: userRow, error: userError } = await supabaseAdmin.auth.admin.getUserById(tokenClaims.sub)
  if (userError || !userRow?.user) {
    return res.status(401).json({ error: 'Invalid session.' })
  }

  req.user = userRow.user
  next()
}

// Fetch role slug for a user
const getUserRoleSlug = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('roles:roles(slug)')
    .eq('id', userId)
    .single()

  if (error) return null
  return data?.roles?.slug || null
}

// Guard by role
const requireRole = (allowed) => async (req, res, next) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Invalid session.' })

  const roleSlug = await getUserRoleSlug(req.user.id)
  if (!roleSlug || !allowed.includes(roleSlug)) {
    return res.status(403).json({ error: 'Forbidden.' })
  }

  req.userRole = roleSlug
  next()
}

const sampleTypePrefix = {
  Agua: 'AGU',
  Alimento: 'ALI',
  'Bebida alcoholica': 'BEB',
}

const todayStamp = () => {
  const now = new Date()
  const pad = (v) => String(v).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
}

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { email, password, full_name: fullName, role_id: roleIdInput, role } = req.body || {}

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Missing fields.' })
  }

  let roleId = roleIdInput
  if (!roleId && role) {
    const { data: roleRow } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('slug', role)
      .single()
    roleId = roleRow?.id || null
  }

  if (!roleId) {
    return res.status(400).json({ error: 'Missing role_id.' })
  }

  const { data: roleRow, error: roleLookupError } = await supabaseAdmin
    .from('roles')
    .select('id, slug, name')
    .eq('id', roleId)
    .single()

  if (roleLookupError || !roleRow?.id) {
    return res.status(400).json({ error: 'Invalid role_id.' })
  }

  const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !createdUser?.user) {
    return res.status(400).json({ error: createError?.message || 'Failed to create user.' })
  }

  const userId = createdUser.user.id

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    full_name: fullName,
    role_id: roleId,
    role: roleRow.slug,
    active: true,
  })

  if (profileError) {
    return res.status(400).json({ error: profileError.message })
  }

  return res.json({ ok: true, user_id: userId })
})

// List all users (admin only)
app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role_id, roles:roles(slug, name)')
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  return res.json({ data })
})

app.patch('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { role_id: roleId } = req.body || {}

  if (!roleId) {
    return res.status(400).json({ error: 'Missing role_id.' })
  }

  const { data: roleRow } = await supabaseAdmin.from('roles').select('id, slug').eq('id', roleId).single()
  if (!roleRow) {
    return res.status(400).json({ error: 'Invalid role_id.' })
  }

  const { error } = await supabaseAdmin.from('profiles').update({ role_id: roleId, role: roleRow.slug }).eq('id', id)
  if (error) {
    return res.status(400).json({ error: error.message })
  }

  return res.json({ ok: true })
})

app.get('/api/admin/roles', requireAdmin, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('roles')
    .select('id, name, slug, description')
    .order('name', { ascending: true })
  if (error) {
    return res.status(400).json({ error: error.message })
  }
  return res.json({ data })
})

app.get('/api/admin/profiles', requireAdmin, async (req, res) => {
  const idsParam = (req.query?.ids || '').toString()
  if (!idsParam) {
    return res.status(400).json({ error: 'Missing ids param' })
  }

  const ids = idsParam.split(',').map((v) => v.trim()).filter(Boolean)
  if (!ids.length) {
    return res.status(400).json({ error: 'Missing ids param' })
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', ids)

  if (error) {
    console.error('profiles lookup error', { ids, message: error.message, details: error.details })
    return res.json({ data: [] })
  }

  return res.json({ data })
})

app.post('/api/admin/roles', requireAdmin, async (req, res) => {
  const { name, description, slug } = req.body || {}
  const trimmedName = name?.trim()
  const trimmedDescription = description?.trim()
  const roleSlug = slug ? slugify(slug) : trimmedName ? slugify(trimmedName) : ''

  if (!trimmedName || !trimmedDescription || !roleSlug) {
    return res.status(400).json({ error: 'Missing role fields.' })
  }

  const { data: existing } = await supabaseAdmin.from('roles').select('id').eq('slug', roleSlug).single()
  if (existing?.id) {
    return res.status(400).json({ error: 'Role slug already exists.' })
  }

  const { data, error } = await supabaseAdmin
    .from('roles')
    .insert({ name: trimmedName, slug: roleSlug, description: trimmedDescription })
    .select('id, name, slug, description')
    .single()

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  return res.json({ data })
})

// Samples API
app.get('/api/samples', requireAuth, async (_req, res) => {
  const status = _req.query?.status
  let query = supabaseAdmin
    .from('samples')
    .select(SAMPLE_SELECT)
    .order('received_at', { ascending: false, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  const rows = Array.isArray(data) ? data : []
  const filtered = status ? rows.filter((row) => row.status === status) : rows

  // Enrich with user display names for audit fields
  const ids = new Set()
  filtered.forEach((row) => {
    ;[row.updated_by, row.evaluated_by, row.assigned_analyst_id, row.created_by].forEach((id) => {
      if (id) ids.add(id)
    })
  })

  if (ids.size) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(ids))

    const map = {}
    profiles?.forEach((p) => {
      map[p.id] = p.full_name || p.email || p.id
    })

    filtered.forEach((row) => {
      const setName = (field, key) => {
        if (!row[field] && row[key] && map[row[key]]) row[field] = map[row[key]]
      }
      setName('updated_by_name', 'updated_by')
      setName('evaluated_by_name', 'evaluated_by')
      setName('assigned_analyst_name', 'assigned_analyst_id')
      setName('created_by_name', 'created_by')
    })
  }

  return res.json({ data: filtered })
})

app.post('/api/samples', requireAuth, async (req, res) => {
  const {
    type,
    origin,
    transport_condition: transportCondition,
    storage_condition: storageCondition,
    business_name: businessName,
    phone,
    address,
  } = req.body || {}

  if (!type || !origin || !transportCondition || !storageCondition || !businessName || !phone || !address) {
    return res.status(400).json({ error: 'Missing required fields.' })
  }

  const rpcPayload = {
    p_type: type,
    p_origin: origin,
    p_transport_condition: transportCondition,
    p_storage_condition: storageCondition,
    p_business_name: businessName,
    p_phone: phone,
    p_address: address,
    p_user_id: req.user.id,
  }

  const { data, error } = await supabaseAdmin.rpc('register_sample', rpcPayload)

  if (error) {
    console.error('register_sample failed', { error, rpcPayload })
    return res.status(400).json({ error: error.message })
  }

  let row = Array.isArray(data) ? data[0] : data

  // Normalize status to por_asignar if the stored procedure returns another default
  // and stamp received_at if missing so the sample surfaces immediately for evaluador.
  if (row) {
    const updates = {}
    if (row.status && row.status !== 'por_asignar') {
      updates.status = 'por_asignar'
    }
    if (!row.received_at) {
      updates.received_at = new Date().toISOString()
    }

    if (Object.keys(updates).length) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('samples')
        .update(updates)
        .eq('id', row.id)
        .select(SAMPLE_SELECT)
        .single()

      if (!updateError && updated) {
        row = updated
      }
    }
  }

  return res.json({ data: row })
})

// List analysts to allow assignment (accept both old/es and new/en slugs)
app.get('/api/analysts', requireAuth, async (_req, res) => {
  // Primary: role column (enum) in English
  const primary = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, active')
    .eq('role', 'analyst')
    .eq('active', true)
    .order('full_name', { ascending: true })

  if (!primary.error) {
    return res.json({ data: primary.data })
  }

  console.error('list analysts failed (role column), falling back to roles join', primary.error)

  // Fallback: join roles table
  const fallback = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, roles!inner(slug), active')
    .eq('roles.slug', 'analyst')
    .eq('active', true)
    .order('full_name', { ascending: true })

  if (fallback.error) {
    console.error('list analysts fallback failed', fallback.error)
    return res.status(400).json({ error: fallback.error.message })
  }

  return res.json({ data: fallback.data })
})

// Assign analyst and due date -> moves to "esperando_analisis"
app.post('/api/samples/:id/assign', requireAuth, requireRole(['evaluator', 'evaluador', 'admin']), async (req, res) => {
  const { id } = req.params
  const { analyst_id: analystId, due_date: dueDate } = req.body || {}

  if (!analystId || !dueDate) {
    return res.status(400).json({ error: 'Missing analyst_id or due_date.' })
  }

  const { data, error } = await supabaseAdmin
    .from('samples')
    .update({
      assigned_analyst_id: analystId,
      due_date: dueDate,
      status: 'esperando_analisis',
    })
    .eq('id', id)
    .select(SAMPLE_SELECT)
    .single()

  if (error) {
    console.error('assign_sample failed', { error, id, analystId, dueDate })
    return res.status(400).json({ error: error.message })
  }

  return res.json({ data })
})

// Analyst submits analysis -> moves to "pendiente_validacion"
app.post('/api/samples/:id/analysis', requireAuth, requireRole(['analista', 'admin']), async (req, res) => {
  const { id } = req.params
  const { analysis_payload: analysisPayload } = req.body || {}

  if (!analysisPayload) {
    return res.status(400).json({ error: 'Missing analysis_payload.' })
  }

  const { data, error } = await supabaseAdmin
    .from('samples')
    .update({
      analysis_payload: analysisPayload,
      analysis_submitted_at: new Date().toISOString(),
      status: 'pendiente_validacion',
    })
    .eq('id', id)
    .select(SAMPLE_SELECT)
    .single()

  if (error) {
    console.error('analysis_submit failed', { error, id })
    return res.status(400).json({ error: error.message })
  }

  return res.json({ data })
})

// Evaluator validates -> moves to "evaluada"
app.post('/api/samples/:id/validate', requireAuth, requireRole(['evaluator', 'evaluador', 'admin']), async (req, res) => {
  const { id } = req.params
  const { validation_payload: validationPayload, certification_status: certificationStatus } = req.body || {}

  if (!validationPayload) {
    return res.status(400).json({ error: 'Missing validation_payload.' })
  }

  const { data, error } = await supabaseAdmin
    .from('samples')
    .update({
      validation_payload: validationPayload,
      validation_submitted_at: new Date().toISOString(),
      evaluated_by: req.user.id,
      status: 'evaluada',
      certification_status: certificationStatus || null,
    })
    .eq('id', id)
    .select(SAMPLE_SELECT)
    .single()

  if (error) {
    console.error('validation_submit failed', { error, id })
    return res.status(400).json({ error: error.message })
  }

  return res.json({ data })
})

// Generate PDF certificate for a sample (public for easier access)
app.get('/api/samples/:id/pdf', async (req, res) => {
  const { id } = req.params

  const { data: sample, error } = await supabaseAdmin
    .from('samples')
    .select(SAMPLE_SELECT)
    .eq('id', id)
    .single()

  if (error || !sample) {
    return res.status(404).json({ error: 'Sample not found.' })
  }

  // Nota: Permitimos generar PDF aun sin certificacion aprobada para no bloquear al evaluador
  // (se puede reactivar el control revisando certification_status si se requiere).

  const analysis = sample.analysis_payload || {}
  const validation = sample.validation_payload || {}
  const results = validation.results || analysis.results || []

  const analysisMeta = {
    color: analysis.color || validation.color,
    texture: analysis.texture || validation.texture,
    appearance: analysis.appearance || validation.appearance,
    expiration: analysis.expiration || validation.expiration,
    netWeight: analysis.net_weight || validation.net_weight,
    flavor: analysis.flavor || validation.flavor,
  }

  const palette = {
    primary: '#1f4ab8',
    text: '#111827',
    muted: '#6b7280',
    border: '#d6d9e0',
    soft: '#f3f6fb',
  }

  const formatDateTime = (value) => {
    if (!value) return '—'
    const d = new Date(value)
    return d.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (value) => {
    if (!value) return '—'
    const d = new Date(value)
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${sample.code || 'certificado'}.pdf"`)

  const doc = new PDFDocument({ margin: 50 })
  doc.pipe(res)

  doc.fontSize(18).fillColor(palette.text).text('CERTIFICADO DE ANÁLISIS', { align: 'center' })
  doc.moveDown(0.15)
  doc.fontSize(11)
    .fillColor(palette.muted)
    .text(`Número de informe: ${validation.report_number || 'N/A'}`, { align: 'center' })
  doc.moveDown(0.5)
  doc.rect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 2)
    .fill(palette.primary)
  doc.moveDown(1.1)

  const panelLeft = doc.page.margins.left
  const panelWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const panelTop = doc.y
  const colWidth = panelWidth / 2 - 8
  const leftX = panelLeft + 10
  const rightX = panelLeft + colWidth + 16

  doc.save()
  doc.rect(panelLeft, panelTop, panelWidth, 170).fillAndStroke(palette.soft, palette.border)
  doc.fontSize(11).fillColor(palette.text).text('Información de la muestra', leftX, panelTop + 10, {
    width: colWidth,
  })
  doc.fontSize(11).fillColor(palette.text).text('Detalles del cliente', rightX, panelTop + 10, {
    width: colWidth,
  })

  const lineY = panelTop + 26
  doc.moveTo(leftX, lineY).lineTo(leftX + colWidth - 8, lineY).stroke(palette.border)
  doc.moveTo(rightX, lineY).lineTo(rightX + colWidth - 8, lineY).stroke(palette.border)

  let yCursor = lineY + 8
  const field = (label, value, x, width) => {
    doc.fontSize(9).fillColor(palette.muted).text(label, x, yCursor, { width })
    doc.fontSize(11).fillColor(palette.text).text(value || '—', x, yCursor + 12, { width })
    yCursor += 28
  }

  field('Código', sample.code, leftX, colWidth)
  field('Tipo', sample.type, leftX, colWidth)
  field('Origen', sample.origin, leftX, colWidth)
  field('Transporte', sample.transport_condition, leftX, colWidth)
  field('Almacenado', sample.storage_condition, leftX, colWidth)

  let yCursorR = lineY + 8
  const fieldR = (label, value) => {
    doc.fontSize(9).fillColor(palette.muted).text(label, rightX, yCursorR, { width: colWidth })
    doc.fontSize(11).fillColor(palette.text).text(value || '—', rightX, yCursorR + 12, { width: colWidth })
    yCursorR += 28
  }

  fieldR('Nombre', sample.business_name)
  fieldR('Correo', validation.client_email || sample.email || '')
  fieldR('Teléfono', sample.phone)
  fieldR('Dirección', sample.address)

  doc.restore()
  doc.moveDown(7)

  const dateRowTop = panelTop + 178
  const dateWidth = panelWidth / 2 - 10
  doc.fontSize(9).fillColor(palette.muted).text('Fecha de recepción', panelLeft + 10, dateRowTop)
  doc.fontSize(12)
    .fillColor(palette.text)
    .text(formatDateTime(sample.received_at), panelLeft + 10, dateRowTop + 12, { width: dateWidth })
  doc.fontSize(9)
    .fillColor(palette.muted)
    .text('Fecha de emisión', panelLeft + dateWidth + 20, dateRowTop)
  doc
    .fontSize(12)
    .fillColor(palette.text)
    .text(formatDate(validation.report_date || sample.due_date), panelLeft + dateWidth + 20, dateRowTop + 12, {
      width: dateWidth,
    })

  doc.y = dateRowTop + 36
  doc.moveDown(2.2)

  doc.fontSize(12).fillColor(palette.text).text('Resultados de análisis', { underline: false })
  const metaTop = doc.y + 8
  const metaCols = [
    ['Color', analysisMeta.color],
    ['Textura', analysisMeta.texture],
    ['Apariencia', analysisMeta.appearance],
    ['Fecha de expiración', analysisMeta.expiration ? formatDate(analysisMeta.expiration) : '—'],
    ['Peso Neto (g)', analysisMeta.netWeight],
    ['Sabor', analysisMeta.flavor],
  ]
  const metaColWidth = (panelWidth - 16) / 3
  metaCols.forEach((item, idx) => {
    const row = Math.floor(idx / 3)
    const col = idx % 3
    const x = panelLeft + col * (metaColWidth + 8)
    const y = metaTop + row * 36
    doc.rect(x, y - 4, metaColWidth, 34).fillAndStroke(palette.soft, palette.border)
    doc.fontSize(9).fillColor(palette.muted).text(item[0], x + 8, y + 2, { width: metaColWidth - 16 })
    doc.fontSize(11).fillColor(palette.text).text(item[1] || '—', x + 8, y + 14, { width: metaColWidth - 16 })
  })

  const metaRows = Math.ceil(metaCols.length / 3)
  doc.y = metaTop + metaRows * 36 + 4
  doc.moveDown(1.6)

  doc.fontSize(13).fillColor(palette.text).text('Resultados del análisis', { underline: false })
  const tableTop = doc.y + 10
  const startX = doc.page.margins.left
  const colWidths = [150, 100, 90, 140, 80]
  const totalWidth = colWidths.reduce((a, b) => a + b, 0)

  doc.rect(startX, tableTop, totalWidth, 24).fillAndStroke(palette.primary, palette.primary)
  const headers = ['Parámetro', 'Resultado', 'Unidad', 'Rango normal', 'Estado']
  headers.forEach((h, i) => {
    const offset = colWidths.slice(0, i).reduce((a, b) => a + b, 0)
    doc.fontSize(10).fillColor('#ffffff').text(h, startX + offset + 8, tableTop + 6, {
      width: colWidths[i] - 16,
    })
  })

  let rowY = tableTop + 24
  results.forEach((r, idx) => {
    const isEven = idx % 2 === 0
    if (isEven) {
      doc.rect(startX, rowY, totalWidth, 22).fillAndStroke(palette.soft, palette.border)
    } else {
      doc.rect(startX, rowY, totalWidth, 22).stroke(palette.border)
    }

    const cols = [r.param || '', r.value || '', r.unit || '', r.range || '', r.status || '']
    cols.forEach((c, i) => {
      const offset = colWidths.slice(0, i).reduce((a, b) => a + b, 0)
      doc.fontSize(10).fillColor(palette.text).text(String(c), startX + offset + 8, rowY + 6, {
        width: colWidths[i] - 16,
      })
    })

    rowY += 22
  })

  if (!results.length) {
    doc.rect(startX, rowY, totalWidth, 24).stroke(palette.border)
    doc.fontSize(10).fillColor(palette.muted).text('Sin resultados reportados', startX + 8, rowY + 7)
  }

  doc.end()
})

app.patch('/api/admin/roles/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { name, description } = req.body || {}
  const updates = {}
  if (name) updates.name = name.trim()
  if (description) updates.description = description.trim()

  if (!updates.name && !updates.description) {
    return res.status(400).json({ error: 'Missing updates.' })
  }

  const { data, error } = await supabaseAdmin
    .from('roles')
    .update(updates)
    .eq('id', id)
    .select('id, name, slug, description')
    .single()

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  return res.json({ data })
})

app.delete('/api/admin/roles/:id', requireAdmin, async (req, res) => {
  const { id } = req.params

  const { data: inUse } = await supabaseAdmin.from('profiles').select('id').eq('role_id', id).limit(1)
  if (inUse?.length) {
    return res.status(400).json({ error: 'Role is assigned to users.' })
  }

  const { error } = await supabaseAdmin.from('roles').delete().eq('id', id)
  if (error) {
    return res.status(400).json({ error: error.message })
  }

  return res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`LabGuard backend listening on ${PORT}`)
})
