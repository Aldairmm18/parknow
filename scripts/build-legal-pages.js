// Genera las páginas legales públicas de docs/ a partir de constants/legal.ts,
// para que la web y la app digan siempre lo mismo. Google Play pide estas URLs
// en la ficha (política de privacidad y eliminación de cuenta).
//
// Uso: npm run legal   (vuelve a ejecutarlo cada vez que cambies legal.ts)
// Publicación: GitHub Pages desde la carpeta docs/ de la rama principal.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const out = path.join(root, 'docs');

// legal.ts importa `@/config/env`; aquí basta con los valores públicos.
const env = {
  legalBaseUrl: process.env.EXPO_PUBLIC_LEGAL_BASE_URL || 'https://aldairmm18.github.io/parknow',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'aldairmmm2@gmail.com',
  privacyEmail: process.env.EXPO_PUBLIC_PRIVACY_EMAIL || 'aldairmmm2@gmail.com',
};

function loadLegal() {
  const source = fs.readFileSync(path.join(root, 'constants/legal.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  const req = (id) => (id === '@/config/env' ? { env } : require(id));
  new Function('require', 'module', 'exports', outputText)(req, mod, mod.exports);
  return mod.exports;
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Correos y URLs en texto plano → enlaces.
const linkify = (s) =>
  esc(s)
    .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>')
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

const fmtDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

function page(title, body) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — ParkNow</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F5F5F7; color: #202124; line-height: 1.7; padding: 0 16px; }
    .container { max-width: 680px; margin: 48px auto 80px; background: #fff; border: 1px solid #D7D9DE; border-radius: 16px; padding: 40px; }
    .brand { font-weight: 700; color: #5561E1; margin-bottom: 20px; }
    h1 { font-size: 1.8rem; line-height: 1.25; margin-bottom: 8px; }
    .meta { font-size: 0.875rem; color: #71737C; margin-bottom: 32px; }
    h2 { font-size: 1.15rem; margin: 28px 0 10px; }
    p, li { font-size: 0.97rem; margin-bottom: 10px; }
    ol, ul { margin: 0 0 14px 22px; }
    a { color: #4550BC; overflow-wrap: anywhere; }
    footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #E9EAED; font-size: 0.875rem; }
    footer a { margin-right: 16px; }
    @media (prefers-color-scheme: dark) {
      body { background: #171C46; color: #E9EAED; }
      .container { background: #202124; border-color: #37383C; }
      .brand, a { color: #ADBCFF; }
      .meta { color: #A0A2AB; }
      footer { border-color: #37383C; }
    }
    @media (max-width: 520px) { .container { padding: 24px; margin: 24px auto 48px; } }
  </style>
</head>
<body>
  <main class="container">
    <div class="brand">ParkNow</div>
${body}
    <footer>
      <a href="privacy-policy.html">Política de privacidad</a>
      <a href="terms.html">Términos del servicio</a>
      <a href="delete-account.html">Eliminar tu cuenta</a>
    </footer>
  </main>
</body>
</html>
`;
}

// Agrupa los párrafos que empiezan por "• " en listas.
function renderParagraphs(paragraphs) {
  const html = [];
  let list = [];
  const flush = () => {
    if (list.length) html.push(`      <ul>\n${list.map((li) => `        <li>${li}</li>`).join('\n')}\n      </ul>`);
    list = [];
  };
  for (const p of paragraphs) {
    if (p.startsWith('• ')) list.push(linkify(p.slice(2)));
    else {
      flush();
      html.push(`      <p>${linkify(p)}</p>`);
    }
  }
  flush();
  return html.join('\n');
}

function renderDocument(doc) {
  const sections = doc.sections
    .map((s) => `    <h2>${esc(s.heading)}</h2>\n${renderParagraphs(s.paragraphs)}`)
    .join('\n');
  return page(
    doc.title,
    `    <h1>${esc(doc.title)}</h1>
    <p class="meta">${esc(doc.subtitle)} · Versión ${esc(doc.version)} · Última actualización: ${fmtDate(doc.lastUpdated)}</p>
${sections}`,
  );
}

function renderDeleteAccount(E, lastUpdated) {
  return page(
    'Eliminar tu cuenta',
    `    <h1>Eliminar tu cuenta de ParkNow</h1>
    <p class="meta">Desarrollador: ${esc(E.companyName)} · Última actualización: ${fmtDate(lastUpdated)}</p>

    <h2>Desde la app (inmediato)</h2>
    <ol>
      <li>Abre ParkNow e inicia sesión.</li>
      <li>Ve a la pestaña <strong>Perfil</strong> y toca <strong>Privacidad y datos</strong>.</li>
      <li>Al final de la pantalla, toca <strong>Eliminar mi cuenta</strong> y confirma dos veces.</li>
    </ol>
    <p>Si en ese momento tienes un vehículo dentro de un parqueadero, primero registra la salida.</p>

    <h2>Sin acceso a la app</h2>
    <p>Escribe a ${linkify(E.privacyEmail)} con el asunto «Eliminar mi cuenta de ParkNow» desde el correo con el que te registraste. Eliminaremos tu cuenta en un máximo de 30 días y te confirmaremos por correo.</p>

    <h2>Qué se elimina</h2>
    <ul>
      <li>Tu cuenta: nombre, correo, celular, foto de perfil e identificadores de inicio de sesión.</li>
      <li>Las reservas futuras, que se cancelan y liberan su cupo.</li>
      <li>Las reservas sin pago, tus códigos QR y las placas de tus vehículos.</li>
    </ul>

    <h2>Qué se conserva</h2>
    <p>Las reservas que ya pagaste se conservan de forma anónima (sin tu nombre, correo ni placa) durante cinco (5) años, por las obligaciones contables y tributarias colombianas. Las copias de respaldo automáticas del proveedor de base de datos pueden contener datos hasta por 30 días antes de borrarse definitivamente.</p>

    <h2>Política de privacidad</h2>
    <p>Consulta los detalles en la <a href="privacy-policy.html">política de privacidad</a>.</p>`,
  );
}

const legal = loadLegal();
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'privacy-policy.html'), renderDocument(legal.PRIVACY_POLICY));
fs.writeFileSync(path.join(out, 'terms.html'), renderDocument(legal.TERMS_OF_SERVICE));
fs.writeFileSync(path.join(out, 'delete-account.html'), renderDeleteAccount(legal.LEGAL_ENTITY, legal.LEGAL_LAST_UPDATED));
fs.writeFileSync(
  path.join(out, 'index.html'),
  page('Información legal', `    <h1>ParkNow</h1>
    <p class="meta">Reserva tu parqueadero y llega directo a tu puesto.</p>
    <p>Aquí encontrarás la información legal de la app.</p>`),
);
console.log('Páginas generadas en', out);
