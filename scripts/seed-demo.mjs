/**
 * Popula a empresa ativa com dados de demonstração: categorias, produtos,
 * clientes e ~90 dias de movimentações de estoque.
 *
 *   node scripts/seed-demo.mjs            # semeia
 *   node scripts/seed-demo.mjs --clean    # remove só o que foi semeado
 *
 * Tudo que é criado aqui leva a marca DEMO_TAG em `reason`/`notes`, então a
 * limpeza não encosta em dados reais que você tenha cadastrado pela tela.
 */
import 'dotenv/config';
import { Client } from 'pg';

const DEMO_TAG = '[demo]';

const CATEGORIES = ['Ferramentas', 'Elétrica', 'Hidráulica', 'Pintura', 'Fixação'];

const PRODUCTS = [
  ['Furadeira de impacto 650W', 'FER-0001', 'Ferramentas', 'UN', 189.9, 329.9, 5],
  ['Parafusadeira 12V', 'FER-0002', 'Ferramentas', 'UN', 142.0, 259.0, 4],
  ['Jogo de chaves combinadas 10 pç', 'FER-0003', 'Ferramentas', 'UN', 68.5, 129.9, 6],
  ['Serra tico-tico 500W', 'FER-0004', 'Ferramentas', 'UN', 210.0, 379.0, 3],
  ['Martelo unha 27mm', 'FER-0005', 'Ferramentas', 'UN', 22.4, 44.9, 10],
  ['Trena 5m', 'FER-0006', 'Ferramentas', 'UN', 11.2, 24.9, 12],
  ['Cabo flexível 2,5mm² 100m', 'ELE-0001', 'Elétrica', 'RL', 178.0, 289.0, 8],
  ['Disjuntor bipolar 25A', 'ELE-0002', 'Elétrica', 'UN', 31.5, 59.9, 15],
  ['Tomada 2P+T 10A', 'ELE-0003', 'Elétrica', 'UN', 6.8, 14.9, 40],
  ['Interruptor simples', 'ELE-0004', 'Elétrica', 'UN', 5.2, 11.9, 40],
  ['Lâmpada LED 9W', 'ELE-0005', 'Elétrica', 'UN', 7.9, 16.9, 50],
  ['Fita isolante 20m', 'ELE-0006', 'Elétrica', 'UN', 4.1, 9.9, 30],
  ['Tubo PVC 25mm 6m', 'HID-0001', 'Hidráulica', 'BR', 18.9, 36.9, 20],
  ['Joelho PVC 25mm', 'HID-0002', 'Hidráulica', 'UN', 1.4, 3.5, 100],
  ['Registro esfera 25mm', 'HID-0003', 'Hidráulica', 'UN', 24.0, 48.9, 12],
  ['Veda rosca 18mm', 'HID-0004', 'Hidráulica', 'UN', 2.3, 5.9, 60],
  ['Caixa d’água 500L', 'HID-0005', 'Hidráulica', 'UN', 289.0, 489.0, 2],
  ['Tinta acrílica branca 18L', 'PIN-0001', 'Pintura', 'LT', 198.0, 329.0, 6],
  ['Rolo de lã 23cm', 'PIN-0002', 'Pintura', 'UN', 14.5, 29.9, 15],
  ['Pincel 2"', 'PIN-0003', 'Pintura', 'UN', 7.2, 15.9, 20],
  ['Massa corrida 25kg', 'PIN-0004', 'Pintura', 'SC', 62.0, 109.0, 8],
  ['Lixa massa 120', 'PIN-0005', 'Pintura', 'UN', 1.1, 2.9, 80],
  ['Parafuso bucha 8mm 100 pç', 'FIX-0001', 'Fixação', 'CX', 21.0, 42.9, 15],
  ['Prego 17x27 1kg', 'FIX-0002', 'Fixação', 'KG', 12.8, 24.9, 20],
  ['Abraçadeira nylon 200mm 100 pç', 'FIX-0003', 'Fixação', 'CX', 16.4, 32.9, 10],
];

const CUSTOMERS = [
  ['Construtora Horizonte Ltda', 'COMPANY', '11444777000161', 'contato@horizonte.com.br', '11987654321', 'São Paulo', 'SP'],
  ['Marcenaria Carvalho ME', 'COMPANY', '34238864000168', 'vendas@carvalho.com.br', '11976543210', 'Guarulhos', 'SP'],
  ['Elétrica Fonseca', 'COMPANY', '04252011000110', 'fonseca@eletrica.com.br', '21965432109', 'Niterói', 'RJ'],
  ['Reformas Aurora Ltda', 'COMPANY', '10517137000170', 'aurora@reformas.com.br', '31954321098', 'Belo Horizonte', 'MG'],
  ['Hidráulica Souza & Cia', 'COMPANY', '27865757000102', 'souza@hidraulica.com.br', '41943210987', 'Curitiba', 'PR'],
  ['Pinturas Bela Vista', 'COMPANY', '24086670000198', 'contato@belavista.com.br', '51932109876', 'Porto Alegre', 'RS'],
  ['Engenharia Delta Ltda', 'COMPANY', '33041260065290', 'projetos@delta.eng.br', '11921098765', 'Campinas', 'SP'],
  ['Serralheria Ipê', 'COMPANY', '45997418000153', 'ipe@serralheria.com.br', '11910987654', 'Osasco', 'SP'],
  ['Ana Paula Ribeiro', 'INDIVIDUAL', '52998224725', 'ana.ribeiro@email.com', '11998877665', 'São Paulo', 'SP'],
  ['Carlos Eduardo Lima', 'INDIVIDUAL', '87748248800', 'carlos.lima@email.com', '21987766554', 'Rio de Janeiro', 'RJ'],
  ['Mariana Costa Alves', 'INDIVIDUAL', '19357235860', 'mariana.alves@email.com', '31976655443', 'Contagem', 'MG'],
  ['Roberto Nunes', 'INDIVIDUAL', '63017285006', 'roberto.nunes@email.com', '41965544332', 'São José dos Pinhais', 'PR'],
  ['Juliana Martins', 'INDIVIDUAL', '04558218080', 'juliana.martins@email.com', '51954433221', 'Canoas', 'RS'],
  ['Felipe Andrade', 'INDIVIDUAL', '13082559860', 'felipe.andrade@email.com', '11943322110', 'Santo André', 'SP'],
  ['Patrícia Gomes', 'INDIVIDUAL', '70830592867', 'patricia.gomes@email.com', '11932211009', 'São Bernardo do Campo', 'SP'],
];

const IN_REASONS = ['Compra do fornecedor', 'Reposição de estoque', 'Devolução de cliente'];
const OUT_REASONS = ['Venda no balcão', 'Venda para obra', 'Uso interno'];

// Gerador determinístico — rodar duas vezes produz o mesmo cenário.
let seed = 20260101;
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function clean(enterpriseId) {
  await client.query('BEGIN');
  // O trigger append-only bloqueia DELETE em stock_movement; desativa só
  // durante a limpeza da demo.
  await client.query('ALTER TABLE stock_movement DISABLE TRIGGER stock_movement_no_update_delete');
  await client.query(
    `DELETE FROM stock_movement WHERE enterprise_id = $1 AND reason LIKE $2`,
    [enterpriseId, `%${DEMO_TAG}`]
  );
  await client.query('ALTER TABLE stock_movement ENABLE TRIGGER stock_movement_no_update_delete');
  await client.query(`DELETE FROM product WHERE enterprise_id = $1 AND description LIKE $2`, [
    enterpriseId,
    `%${DEMO_TAG}`,
  ]);
  await client.query(`DELETE FROM product_category WHERE enterprise_id = $1 AND name = ANY($2)`, [
    enterpriseId,
    CATEGORIES,
  ]);
  await client.query(`DELETE FROM customer WHERE enterprise_id = $1 AND notes LIKE $2`, [
    enterpriseId,
    `%${DEMO_TAG}`,
  ]);
  await client.query('COMMIT');
  console.log('Dados de demonstração removidos.');
}

try {
  const { rows: enterprises } = await client.query(
    `SELECT id, name FROM remus_enterprise WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`
  );

  if (!enterprises.length) {
    throw new Error('Nenhuma empresa encontrada. Rode prisma/sql/03_v1_bootstrap.sql primeiro.');
  }

  const enterpriseId = enterprises[0].id;
  const { rows: users } = await client.query(`SELECT id FROM auth_user ORDER BY created_at LIMIT 1`);
  const userId = users[0]?.id ?? null;

  if (process.argv.includes('--clean')) {
    await clean(enterpriseId);
    process.exit(0);
  }

  await clean(enterpriseId);
  await client.query('BEGIN');

  // --- Categorias --------------------------------------------------------
  const categoryIds = new Map();

  for (const name of CATEGORIES) {
    const { rows } = await client.query(
      `INSERT INTO product_category (enterprise_id, name, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [enterpriseId, name, userId]
    );
    categoryIds.set(name, rows[0].id);
  }

  // --- Produtos ----------------------------------------------------------
  const products = [];

  for (const [name, sku, category, unit, cost, sale, minStock] of PRODUCTS) {
    const { rows } = await client.query(
      `INSERT INTO product
         (enterprise_id, name, sku, category_id, unit, cost_price, sale_price, min_stock, max_stock, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        enterpriseId,
        name,
        sku,
        categoryIds.get(category),
        unit,
        cost,
        sale,
        minStock,
        minStock * 10,
        `Produto de demonstração ${DEMO_TAG}`,
        userId,
      ]
    );
    products.push({ id: rows[0].id, minStock });
  }

  // --- Clientes ----------------------------------------------------------
  for (const [name, personType, document, email, phone, city, state] of CUSTOMERS) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - between(0, 200));

    await client.query(
      `INSERT INTO customer
         (enterprise_id, name, person_type, document, email, phone, city, state, status, notes, created_at, updated_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12)`,
      [
        enterpriseId,
        name,
        personType,
        document,
        email,
        phone,
        city,
        state,
        random() > 0.15 ? 'ACTIVE' : 'INACTIVE',
        `Cliente de demonstração ${DEMO_TAG}`,
        createdAt,
        userId,
      ]
    );
  }

  // --- Movimentações de estoque -----------------------------------------
  // Cada produto recebe uma carga inicial e depois um vai-e-vem de 90 dias.
  // O saldo é conferido a cada passo para nunca ficar negativo, e uma fatia
  // dos produtos termina abaixo do mínimo para exercitar os alertas.
  let movementCount = 0;

  for (const [index, product] of products.entries()) {
    let balance = 0;

    const opening = product.minStock * between(5, 7);
    const openingDate = new Date();
    openingDate.setDate(openingDate.getDate() - 90);

    await client.query(
      `INSERT INTO stock_movement (enterprise_id, product_id, type, quantity, reason, created_at, created_by)
       VALUES ($1,$2,'IN',$3,$4,$5,$6)`,
      [enterpriseId, product.id, opening, `Estoque inicial ${DEMO_TAG}`, openingDate, userId]
    );
    balance += opening;
    movementCount += 1;

    // Um em cada cinco produtos termina abaixo do mínimo, para a tela de
    // alertas ter o que mostrar. Os demais oscilam dentro da faixa
    // mínimo..máximo — vendendo todo dia e repondo quando encosta no mínimo,
    // que é como um estoque real se comporta.
    const shouldEndLow = index % 5 === 0;
    const maxStock = product.minStock * 10;
    const restockTarget = Math.round(maxStock * 0.7);

    for (let day = 89; day >= 0; day -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      date.setHours(between(8, 18), between(0, 59), 0, 0);

      // Saída quase diária, proporcional ao giro do item.
      if (random() < 0.7) {
        const demand = Math.max(1, Math.round(product.minStock * (0.15 + random() * 0.45)));
        const quantity = Math.min(balance, demand);

        if (quantity > 0) {
          await client.query(
            `INSERT INTO stock_movement (enterprise_id, product_id, type, quantity, reason, created_at, created_by)
             VALUES ($1,$2,'OUT',$3,$4,$5,$6)`,
            [enterpriseId, product.id, quantity, `${pick(OUT_REASONS)} ${DEMO_TAG}`, date, userId]
          );
          balance -= quantity;
          movementCount += 1;
        }
      }

      // Reposição ao encostar no mínimo. Nos últimos 12 dias os produtos
      // marcados param de repor, e é assim que terminam em falta.
      const stillRestocking = !(shouldEndLow && day <= 12);

      if (balance <= product.minStock && stillRestocking) {
        const quantity = Math.max(1, restockTarget - balance);

        await client.query(
          `INSERT INTO stock_movement (enterprise_id, product_id, type, quantity, reason, reference, created_at, created_by)
           VALUES ($1,$2,'IN',$3,$4,$5,$6,$7)`,
          [
            enterpriseId,
            product.id,
            quantity,
            `${pick(IN_REASONS)} ${DEMO_TAG}`,
            `NF ${between(1000, 9999)}`,
            date,
            userId,
          ]
        );
        balance += quantity;
        movementCount += 1;
      }
    }

    // Um ajuste ocasional, para a tela de histórico mostrar os três tipos.
    if (index % 7 === 0 && balance > 2) {
      const date = new Date();
      date.setDate(date.getDate() - between(1, 20));

      await client.query(
        `INSERT INTO stock_movement (enterprise_id, product_id, type, quantity, reason, created_at, created_by)
         VALUES ($1,$2,'ADJUSTMENT',$3,$4,$5,$6)`,
        [enterpriseId, product.id, -1, `Divergência no inventário ${DEMO_TAG}`, date, userId]
      );
      movementCount += 1;
    }
  }

  await client.query('COMMIT');

  console.log(`Empresa .............. ${enterprises[0].name}`);
  console.log(`Categorias ........... ${CATEGORIES.length}`);
  console.log(`Produtos ............. ${products.length}`);
  console.log(`Clientes ............. ${CUSTOMERS.length}`);
  console.log(`Movimentações ........ ${movementCount}`);
  console.log('\nPara remover: node scripts/seed-demo.mjs --clean');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
