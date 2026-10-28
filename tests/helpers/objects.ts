import { expect, Page, Locator } from "@playwright/test";
import { escapeRegExp } from "./ui";

const CARD_VISIBILITY_TIMEOUT = 10_000;
const PAGE_READY_TIMEOUT = 15_000;
const PAGE_RELOAD_TIMEOUT = 20_000;
const CARD_LIST_REFRESHES = 2;

export type ObjectDetailsExpected = {
  address: RegExp;
  stagesCount: RegExp;
};

export async function goToConstructionObjects(page: Page) {
  const menuItem = page
    .locator('[role="menuitem"]')
    .filter({ has: page.locator(".ant-menu-title-content", { hasText: /Объекты строительства/i }) })
    .first();

  await menuItem.click();

  await expect(page.locator("h3", { hasText: /Объекты строительства/i }).first()).toBeVisible({
    timeout: 20_000,
  });
}

function objectCardByName(page: Page, shortName: string) {
  const nameRe = new RegExp(`^\\s*${escapeRegExp(shortName)}\\s*$`);

  return page
    .locator('div[class*="_card_"], div[class*="Pe-card"]')
    .filter({
      has: page.locator("h5").filter({ hasText: nameRe }),
    })
    .first();
}

async function ensureObjectCardVisible(page: Page, shortName: string, opts?: { reloads?: number }) {
  const reloads = opts?.reloads ?? CARD_LIST_REFRESHES;

  const tryApplySearch = async () => {
    const search = page
      .locator(
        [
          'input[type="search"]',
          ".ant-input-group input",
          ".ant-input-affix-wrapper input",
        ].join(", ")
      )
      .first();
    if (await search.isVisible()) {
      await search.fill(shortName);
    }
  };

  for (let attempt = 0; attempt <= reloads; attempt++) {
    await tryApplySearch();

    const card = objectCardByName(page, shortName);
    // Созданный объект ожидает обработки в очереди перед появлением в списке.
    try {
      await expect(card).toBeVisible({ timeout: CARD_VISIBILITY_TIMEOUT });
      return card;
    } catch (error) {
      if (attempt === reloads) throw error;
    }

    await page.reload({ waitUntil: "domcontentloaded", timeout: PAGE_RELOAD_TIMEOUT });
    await expect(page.locator("h3", { hasText: /Объекты строительства/i }).first()).toBeVisible({
      timeout: PAGE_READY_TIMEOUT,
    });
  }

  throw new Error(`Объект "${shortName}" не появился в списке`);
}

async function expectCardField(card: Locator, label: string | RegExp, value: RegExp) {
  const labelLoc = card.getByText(label, { exact: false }).first();
  await expect(labelLoc).toBeVisible({ timeout: 20_000 });

  const valueLoc = labelLoc.locator("xpath=following-sibling::*[1]").first();
  await expect(valueLoc).toBeVisible({ timeout: 20_000 });
  await expect(valueLoc).toHaveText(value, { timeout: 20_000 });
}

function expectedRoleOnCard(inputRole: string): RegExp {
  const H = "[-‐-‒–—−]";
  const ws = "\\s*";

  const r = inputRole.trim().toLowerCase();

  if (r === "заказчик") {
    return new RegExp(`^${ws}Заказчик${ws}$`, "i");
  }

  if (r.includes("гип")) {
    return new RegExp(
      `^\\s*ГИП(?:\\s*\\(\\s*проектная\\s+организация\\s*\\))?\\s*$`,
      "i"
    );
  }

  if (r.includes("инженер")) {
    return new RegExp(`^${ws}Инженер${ws}${H}${ws}проектировщик${ws}$`, "i");
  }

  return new RegExp(`^${ws}${escapeRegExp(inputRole.trim())}${ws}$`, "i");
}

export async function verifyObjectCardOnList(page: Page, opts: { shortName: string; role: string }) {
  const { shortName, role } = opts;

  const card = await ensureObjectCardVisible(page, shortName);

  await expectCardField(card, /Роль/i, expectedRoleOnCard(role));
  await expectCardField(card, /Статус/i, /В ожидании/i);
  await expectCardField(card, /Дата\s*создания/i, /\d{2}\.\d{2}\.\d{4}/);
  await expectCardField(card, /Шифр/i, /00\.00\.000\.000/);

}

export async function openObjectFromList(page: Page, shortName: string) {
  const card = await ensureObjectCardVisible(page, shortName);

  await card.getByText(shortName, { exact: true }).first().click();
  await expect(page.locator(".ant-breadcrumb")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".ant-breadcrumb").getByText(shortName)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("h1,h2,h3").filter({ hasText: shortName }).first()).toBeVisible({ timeout: 20_000 });
}

export async function expandAndVerifyObjectDetails(
  page: Page,
  opts: {
    shortName: string;
    fullName: string;
    expected: ObjectDetailsExpected;
    constructionKind: string;
    objectKind: string;
  }
) {
  const { shortName, fullName, expected, constructionKind, objectKind } = opts;

  const item = page
    .locator(".ant-collapse-item")
    .filter({ has: page.getByText(shortName, { exact: true }) })
    .filter({ hasNot: page.locator(".footer") })
    .first();

  const header = item.locator(".ant-collapse-header[role='button']");
  await expect(header).toBeVisible({ timeout: 20_000 });

  const expandedMarker = item.getByText(/Полное название объекта/i).first();

  if (!(await expandedMarker.isVisible())) {
    // Во время анимации панели header иногда не принимает клик. В этом случае нажимаем отдельную иконку раскрытия.
    await header.click({ position: { x: 20, y: 20 }, timeout: 15_000 }).catch(async () => {
      await header.locator(".ant-collapse-expand-icon").click({ timeout: 15_000, force: true });
    });

    await expect(header).toHaveAttribute("aria-expanded", "true", { timeout: 10_000 });
    await expect(expandedMarker).toBeVisible({ timeout: 10_000 });
  }

  const expectField = async (labelRe: RegExp, valueRe: RegExp) => {
    const label = item.locator("label").filter({ hasText: labelRe }).first();
    await expect(label).toBeVisible({ timeout: 20_000 });

    const container = label.locator("..");
    await expect(container.locator(".ant-typography").first()).toHaveText(valueRe, { timeout: 20_000 });
  };

  await expectField(/Полное название объекта/i, new RegExp(escapeRegExp(fullName), "i"));
  await expectField(/Адрес объекта/i, expected.address);
  await expectField(/Количество этапов/i, expected.stagesCount);
  await expectField(/Вид строительства/i, new RegExp(escapeRegExp(constructionKind), "i"));
  await expectField(/Вид объекта/i, new RegExp(escapeRegExp(objectKind), "i"));
}
