import { expect, Page } from "@playwright/test";
import { escapeRegExp } from "./ui";

async function maybeAcceptCookies(page: Page) {
  const accept = page.getByRole("button", { name: /принимаю/i }).first();
  if (await accept.isVisible()) {
    // Баннер может исчезнуть сам во время инициализации страницы.
    await accept.click().catch(() => {});
  }
}

export type ConstructionKind =
  | "Новое строительство"
  | "Реконструкция"
  | "Капитальный ремонт"
  | "Снос";

export type ObjectKind =
  | "Объект производственного назначения"
  | "Линейный объект"
  | "Объект непроизводственного назначения";

export type StagesKind = "Без этапов" | "2 этапа" | "3 этапа" | "4 этапа";

export type AddressInput = {
  searchText: string;
  optionText: string;
};

export type ObjectCreateData = {
  role: string;
  address: AddressInput;
  constructionKind: ConstructionKind;
  objectKind: ObjectKind;
  stagesKind: StagesKind;
};

export type CreateObjectOptions = ObjectCreateData & {
  shortName: string;
  fullName: string;
};

function toLooseNameRe(value: string | RegExp): RegExp {
  if (value instanceof RegExp) return value;
  return new RegExp(`^\\s*${escapeRegExp(value.trim())}\\s*$`, "i");
}

async function selectOptionsGroupByHeader(opts: {
  page: Page;
  headerText: string;
  pick: string | RegExp;
  fallbackIndex?: number;
}) {
  const { page, headerText, pick, fallbackIndex } = opts;

  const group = page
    .locator(`h4.ant-typography:has-text(\"${headerText}\")`)
    .locator("xpath=following-sibling::*[1]");

  const option = group.getByRole("option", { name: toLooseNameRe(pick) }).first();
  if (await option.count()) {
    await option.click();
    return;
  }

  if (fallbackIndex != null) {
    const fallback = group.getByRole("option").nth(fallbackIndex);
    await fallback.click();
    return;
  }

  throw new Error(`Не нашёл опцию "${String(pick)}" в группе "${headerText}"`);
}

async function selectAutoCompleteById(opts: {
  page: Page;
  id: string;
  typeText: string;
  pickText?: string;
  pickContains?: RegExp;
}) {
  const { page, id, typeText, pickText, pickContains } = opts;

  const input = page.locator(`#${id}`);
  await expect(input).toBeVisible({ timeout: 15_000 });
  await expect(input).toBeEditable({ timeout: 15_000 });

  await input.click();
  await input.fill(typeText);

  const dropdown = page.locator(".ant-select-dropdown:visible").first();
  const options = dropdown.locator(".ant-select-item-option-content");

  await expect(options.first()).toBeVisible({ timeout: 15_000 });

  const exactRe = (s: string) => new RegExp(`^\\s*${escapeRegExp(s)}\\s*$`, "i");

  if (pickText) {
    const exact = options.filter({ hasText: exactRe(pickText) }).first();
    if (await exact.count()) {
      await exact.click();
      return;
    }
  }

  if (pickContains) {
    const contains = options.filter({ hasText: pickContains }).first();
    if (await contains.count()) {
      await contains.click();
      return;
    }
  }

  if (pickText || pickContains) {
    throw new Error(`Не нашёл вариант адреса для "${typeText}"`);
  }

  await options.first().click();
}

export async function clickCreateObject(page: Page) {
  await maybeAcceptCookies(page);

  const shortName = page.locator("#buildObjectShortName");
  if (await shortName.isVisible()) return;

  const btn = page.getByRole("button", { name: /^создать объект$/i }).first();
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled();
  await btn.click();

  await expect(page.locator("#buildObjectShortName")).toBeVisible({ timeout: 60_000 });
}

export async function fillCreateObjectRequiredFields(
  page: Page,
  opts: CreateObjectOptions
) {
  const {
    shortName,
    fullName,
    role,
    address,
    constructionKind,
    objectKind,
    stagesKind,
  } = opts;

  await maybeAcceptCookies(page);

  const shortNameInput = page.locator("#buildObjectShortName");
  await expect(shortNameInput).toBeVisible();
  await expect(shortNameInput).toBeEditable();
  await shortNameInput.fill(shortName);

  const fullNameInput = page.locator("#buildObjectName");
  await expect(fullNameInput).toBeVisible();
  await fullNameInput.fill(fullName);

  await selectOptionsGroupByHeader({
    page,
    headerText: "Вид строительства",
    pick: constructionKind,
  });

  await selectOptionsGroupByHeader({
    page,
    headerText: "Вид объекта",
    pick: objectKind,
  });

  await selectOptionsGroupByHeader({
    page,
    headerText: "Этапы строительства",
    pick: stagesKind,
  });

  await selectAutoCompleteById({
    page,
    id: "searchAddress",
    typeText: address.searchText,
    pickText: address.optionText,
  });

  await selectAntDropdownById({
    page,
    id: "capCodeId",
    pickText: role,
  });
}

export async function submitCreateObject(page: Page) {
  await maybeAcceptCookies(page);

  const submit = page.getByRole("button", { name: /^создать объект$/i }).first();
  await expect(submit).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.locator(".ant-form-item-explain-error")).toHaveCount(0);
}

export async function createObject(
  page: Page,
  opts: CreateObjectOptions
) {
  await clickCreateObject(page);
  await fillCreateObjectRequiredFields(page, opts);
  await submitCreateObject(page);
}

async function selectAntDropdownById(opts: { page: Page; id: string; pickText: string }) {
  const { page, id, pickText } = opts;

  const select = page.locator(`.ant-select:has(#${id})`).first();
  await select.locator(".ant-select-selector").first().click();

  const dropdown = page.locator(".ant-select-dropdown:visible").first();
  await expect(dropdown).toBeVisible({ timeout: 15_000 });

  const item = dropdown.locator(".ant-select-item-option-content", {
    hasText: new RegExp(`^\\s*${escapeRegExp(pickText.trim())}\\s*$`, "i"),
  }).first();

  await item.click();

  await expect(select.locator(".ant-select-selection-item"))
    .toHaveText(new RegExp(escapeRegExp(pickText.trim()), "i"), { timeout: 15_000 });
}
