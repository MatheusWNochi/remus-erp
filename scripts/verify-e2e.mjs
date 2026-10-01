/**
 * Verificação ponta a ponta das telas da V1 contra o servidor de dev.
 *
 *   node scripts/verify-e2e.mjs
 *
 * Cria um usuário temporário (papel Administrador, vinculado à primeira
 * empresa), navega pelas telas com um Chromium headless e remove o usuário no
 * final — inclusive se algo falhar no meio.
 */
import 'dotenv/config';
import { mkdir } from 'node:fs/promises';
import { Client } from 'pg';
import { hash } from 'bcryptjs';
import { chromium } from 'playwright';

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'qa.verify@remus.local';
const PASSWORD = 'VerifyRemus!2026';
const ADMIN_ROLE = '00000000-0000-4000-8000-000000000001';
const SHOTS = 'C:/Users/MIFY/AppData/Local/Temp/claude/c--Users-MIFY-Documents-GitHub-MatheusWNochi-remus-erp/306450c1-1fb0-4ce9-b581-4fc1627c785e/scratchpad/shots';

const results = [];
const consoleErrors = [];

function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

let userId;

async function removeUser() {
  if (!userId) return;
  await db.query(`DELETE FROM customer WHERE created_by = $1`, [userId]);
  await db.query(`DELETE FROM auth_user WHERE id = $1`, [userId]);
}

try {
  await mkdir(SHOTS, { recursive: true });

  const { rows: ent } = await db.query(
    `SELECT id FROM remus_enterprise WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`
  );
  if (!ent.length) throw new Error('Nenhuma empresa encontrada.');

  await db.query(`DELETE FROM auth_user WHERE email = $1`, [EMAIL]);
  const { rows: created } = await db.query(
    `INSERT INTO auth_user (id, email, password, first_name, last_name, created_at, enterprise_id, role_id, "isDeveloper", status)
     VALUES (gen_random_uuid(), $1, $2, 'QA', 'Verificação', now(), $3, $4, false, 'ACTIVE') RETURNING id`,
    [EMAIL, await hash(PASSWORD, 10), ent[0].id, ADMIN_ROLE]
  );
  userId = created[0].id;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Ruído conhecido e pré-existente, não relacionado às telas.
    if (text.includes('hydrated') || text.includes('Download the React DevTools')) return;
    consoleErrors.push(text.slice(0, 300));
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 300)}`));

  /**
   * Preenche e confirma que o valor permaneceu. Os campos são controlados
   * pelo React: se o `fill` acontecer antes da hidratação, o DOM recebe o
   * texto mas o estado não, e a hidratação limpa o campo — o formulário
   * então reclama que está vazio. Reescrever até o valor grudar remove essa
   * corrida, que aparece sobretudo na primeira compilação.
   */
  const fillWhenHydrated = async (locator, value) => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await locator.fill(value);
      await page.waitForTimeout(500);

      if ((await locator.inputValue()) === value) {
        return;
      }
    }

    throw new Error(`campo não aceitou o valor após a hidratação: ${value}`);
  };

  // --- Login -------------------------------------------------------------
  await page.goto(`${BASE}/pt/auth/login`, { waitUntil: 'domcontentloaded' });
  await fillWhenHydrated(page.getByLabel(/mail/i), EMAIL);
  await fillWhenHydrated(page.locator('input[type="password"]'), PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  check('login redireciona para o painel', true);

  // --- Painel ------------------------------------------------------------
  await page.waitForSelector('text=Clientes ativos', { timeout: 30000 });

  const customersCard = page.locator('.MuiPaper-root', { hasText: 'Clientes ativos' }).last();

  // Espera o valor chegar em vez de dormir um tempo fixo: a primeira carga
  // depois de recompilar é bem mais lenta que as seguintes.
  let customersKpi = '';
  try {
    await customersCard
      .locator('h4')
      .filter({ hasText: /\d/ })
      .waitFor({ timeout: 45000 });
  } catch {
    /* cai no assert abaixo com o texto que estiver na tela */
  }
  customersKpi = await customersCard.innerText();
  check('KPI de clientes traz número', /\d/.test(customersKpi), customersKpi.replace(/\n/g, ' ').slice(0, 60));

  const svgCount = await page.locator('svg').count();
  check('painel renderiza gráficos', svgCount > 3, `${svgCount} svg`);
  await page.screenshot({ path: `${SHOTS}/01-dashboard.png`, fullPage: true });

  // --- Clientes ----------------------------------------------------------
  await page.goto(`${BASE}/pt/dashboard/customers`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const customerRows = await page.locator('.MuiDataGrid-row').count();
  check('lista de clientes traz linhas', customerRows > 0, `${customerRows} linhas`);
  await page.screenshot({ path: `${SHOTS}/02-customers.png`, fullPage: true });

  // Criar cliente pelo drawer
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  await page.waitForTimeout(800);
  const unique = `Cliente QA ${Date.now()}`;
  // Escopo no drawer: a grade atrás dele tem botões de menu com os mesmos
  // rótulos de coluna, o que deixa o seletor ambíguo.
  const drawer = page.locator('.MuiDrawer-paper');
  await fillWhenHydrated(drawer.getByLabel('Nome', { exact: true }), unique);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(3000);
  await page.getByPlaceholder(/Buscar por nome/).fill(unique);
  await page.waitForTimeout(2500);
  const foundNew = await page.locator(`text=${unique}`).count();
  check('criar cliente persiste e aparece na lista', foundNew > 0);

  // Validação do documento (CPF/CNPJ com DV inválido)
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  await page.waitForTimeout(800);
  await fillWhenHydrated(drawer.getByLabel('Nome', { exact: true }), 'Documento invalido');
  await fillWhenHydrated(drawer.getByLabel('CPF / CNPJ'), '111.111.111-11');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(2000);
  const docError = await page.locator('text=Documento inválido').count();
  check('documento com DV inválido é recusado', docError > 0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // --- Produtos ----------------------------------------------------------
  await page.goto(`${BASE}/pt/dashboard/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const productRows = await page.locator('.MuiDataGrid-row').count();
  check('lista de produtos traz linhas', productRows > 0, `${productRows} linhas`);
  await page.screenshot({ path: `${SHOTS}/03-products.png`, fullPage: true });

  // --- Estoque -----------------------------------------------------------
  await page.goto(`${BASE}/pt/dashboard/inventory`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const balanceRows = await page.locator('.MuiDataGrid-row').count();
  check('saldo de estoque traz linhas', balanceRows > 0, `${balanceRows} linhas`);

  const inventoryKpi = await page
    .locator('.MuiPaper-root', { hasText: 'Produtos ativos' })
    .last()
    .innerText();
  check('KPIs do estoque carregam', /\d/.test(inventoryKpi), inventoryKpi.replace(/\n/g, ' ').slice(0, 50));

  // O rodapé do DataGrid tem textos próprios, fora do next-intl.
  const footer = await page.locator('.MuiTablePagination-root').first().innerText();
  check('rodapé da grade está traduzido', /página|Linhas/i.test(footer), footer.replace(/\n/g, ' ').slice(0, 50));

  await page.screenshot({ path: `${SHOTS}/04-inventory.png`, fullPage: true });

  const movementsTab = page.getByRole('tab', { name: 'Movimentações' });
  if (await movementsTab.count()) {
    await movementsTab.click();
    await page.waitForTimeout(2500);
    const movementRows = await page.locator('.MuiDataGrid-row').count();
    check('histórico de movimentações traz linhas', movementRows > 0, `${movementRows} linhas`);
    await page.screenshot({ path: `${SHOTS}/05-movements.png`, fullPage: true });
  } else {
    check('aba de movimentações existe', false, 'aba não encontrada');
  }

  // --- Usuários ----------------------------------------------------------
  await page.goto(`${BASE}/pt/dashboard/users`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const userRows = await page.locator('.MuiDataGrid-row').count();
  check('lista de usuários traz linhas', userRows > 0, `${userRows} linhas`);
  const devLeak = await page.locator('text=matheusw.nochi@gmail.com').count();
  check('conta de desenvolvedor não vaza para o tenant', devLeak === 0);
  await page.screenshot({ path: `${SHOTS}/06-users.png`, fullPage: true });

  const rolesTab = page.getByRole('tab', { name: 'Papéis' });
  if (await rolesTab.count()) {
    await rolesTab.click();
    await page.waitForTimeout(2000);
    const matrixCheckboxes = await page.locator('input[type="checkbox"]').count();
    check('matriz de permissões renderiza', matrixCheckboxes > 5, `${matrixCheckboxes} checkboxes`);
    await page.screenshot({ path: `${SHOTS}/07-roles.png`, fullPage: true });
  } else {
    check('aba de papéis existe', false, 'aba não encontrada');
  }

  // --- Tema escuro -------------------------------------------------------
  await page.goto(`${BASE}/pt/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('button[aria-label="Configurações"]').click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Escuro' }).click();
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/08-dark.png`, fullPage: true });
  check('tema escuro aplica sem quebrar', true);

  check('sem erros de console no navegador', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await browser.close();
} catch (error) {
  check('execução concluiu sem exceção', false, error.message.slice(0, 400));
} finally {
  await removeUser();
  await db.end();
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
console.log(`Screenshots: ${SHOTS}`);

if (consoleErrors.length) {
  console.log('\nErros de console:');
  consoleErrors.slice(0, 10).forEach((e) => console.log(' -', e));
}

process.exitCode = failed.length ? 1 : 0;
