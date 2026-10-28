import { test } from "@playwright/test";
import "dotenv/config";
import { login, logout } from "./helpers/auth";
import {
  createObject,
} from "./helpers/create.object";
import type { ObjectCreateData } from "./helpers/create.object";
import {
  expandAndVerifyObjectDetails,
  goToConstructionObjects,
  openObjectFromList,
  verifyObjectCardOnList,
} from "./helpers/objects";
import type { ObjectDetailsExpected } from "./helpers/objects";

type CreateObjectCase = {
  name: string;
  shortPrefix: string;
  fullPrefix: string;
  object: ObjectCreateData;
  expected: ObjectDetailsExpected;
};

const cases: CreateObjectCase[] = [
  {
    name: "Заказчик",
    shortPrefix: "autotest",
    fullPrefix: "Автотестовый объект",
    object: {
      role: "Заказчик",
      address: {
        searchText: "москва",
        optionText: "г Москва",
      },
      constructionKind: "Реконструкция",
      objectKind: "Линейный объект",
      stagesKind: "2 этапа",
    },
    expected: {
      address: /Россия,\s*Москва/i,
      stagesCount: /^2$/,
    },
  },
  {
    name: "ГИП",
    shortPrefix: "autotest-gip",
    fullPrefix: "Автотестовый объект (ГИП)",
    object: {
      role: "ГИП (проектная организация)",
      address: {
        searchText: "москва",
        optionText: "г Москва",
      },
      constructionKind: "Реконструкция",
      objectKind: "Линейный объект",
      stagesKind: "2 этапа",
    },
    expected: {
      address: /Россия,\s*Москва/i,
      stagesCount: /^2$/,
    },
  },
  {
    name: "Инженер",
    shortPrefix: "autotest-eng",
    fullPrefix: "Автотестовый объект (Инженер)",
    object: {
      role: "Инженер-проектировщик",
      address: {
        searchText: "москва",
        optionText: "г Москва",
      },
      constructionKind: "Реконструкция",
      objectKind: "Линейный объект",
      stagesKind: "2 этапа",
    },
    expected: {
      address: /Россия,\s*Москва/i,
      stagesCount: /^2$/,
    },
  },
];

function requiredEnv(name: "E2E_USER" | "E2E_PASS"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная окружения ${name}`);
  return value;
}

for (const c of cases) {
  test(`Создание объекта (${c.name})`, async ({ page }) => {
    // Создание выполняется асинхронно
    test.setTimeout(5 * 60_000);
    const user = requiredEnv("E2E_USER");
    const pass = requiredEnv("E2E_PASS");

    await login(page, user, pass);

    const stamp = Date.now();
    const shortName = `${c.shortPrefix}-${stamp}`;
    const fullName = `${c.fullPrefix} ${stamp}`;
    const object = { ...c.object, shortName, fullName };

    await createObject(page, object);

    await goToConstructionObjects(page);
    await verifyObjectCardOnList(page, { shortName, role: object.role });
    await openObjectFromList(page, shortName);
    await expandAndVerifyObjectDetails(page, {
      shortName,
      fullName,
      expected: c.expected,
      constructionKind: object.constructionKind,
      objectKind: object.objectKind,
    });
    await logout(page);
  });
}
