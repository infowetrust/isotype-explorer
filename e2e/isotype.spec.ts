import { expect, type Page, test } from "@playwright/test";

const firstFigureId = "w0001-p0038-f99";
const secondFigureId = "w0001-p0042-f99";

const attachPageGuards = (page: Page) => {
  const failures: string[] = [];

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console error: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    const url = response.url();
    if (
      response.status() >= 400 &&
      (url.includes("/data/") || url.includes("/webp/") || url.endsWith("/rj-photo-rig.webp"))
    ) {
      failures.push(`${response.status()} ${url}`);
    }
  });

  return failures;
};

const expectNoPageFailures = (failures: string[]) => {
  expect(failures).toEqual([]);
};

const isMobileViewport = async (page: Page) =>
  page.evaluate(() => window.matchMedia("(max-width: 600px)").matches);

const openFiltersIfNeeded = async (page: Page) => {
  if (await isMobileViewport(page)) {
    await page.getByRole("button", { name: /filters/i }).click();
    await expect(page.locator(".filters-panel")).toHaveClass(/is-open/);
  }
};

const clearFilters = async (page: Page) => {
  if (await isMobileViewport(page)) {
    await page.locator(".filters-panel-clear").click();
    await page.locator(".filters-panel-apply").click();
  } else {
    await page.locator(".chip-clear").click();
  }
};

const expectImageLoaded = async (locator: ReturnType<Page["locator"]>) => {
  await expect
    .poll(async () =>
      locator.evaluate((image) => {
        const img = image as HTMLImageElement;
        return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
      })
    )
    .toBe(true);
};

test("home page renders gallery text and images", async ({ page }, testInfo) => {
  const failures = attachPageGuards(page);

  await page.goto("/");
  await expect(page.locator(".gallery-item").first()).toBeVisible();
  await expect(page.locator(".header-count")).toContainText("Figures");
  await expect(page.getByText("Development of Men's and Women's Occupations")).toBeVisible();
  await expectImageLoaded(page.locator(".gallery-item img").first());

  const brokenVisibleImages = await page.locator("img").evaluateAll((images) =>
    images
      .filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      })
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.getAttribute("src"))
  );
  expect(brokenVisibleImages).toEqual([]);

  await testInfo.attach("home-page", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
  expectNoPageFailures(failures);
});

test("search and filters update results and URL state", async ({ page }) => {
  const failures = attachPageGuards(page);

  await page.goto("/");
  await expect(page.locator(".gallery-item").first()).toBeVisible();

  await page.getByLabel("Search charts").fill("Family Sizes");
  await expect(page).toHaveURL(/q=Family\+Sizes/);
  await expect(page.getByText("Family Sizes").first()).toBeVisible();

  await page.getByLabel("Search charts").fill("");
  await openFiltersIfNeeded(page);
  await page.getByRole("button", { name: /^Bar/ }).click();
  await expect(page).toHaveURL(/types=bar/);
  await page.locator('.color-chip[aria-label="Red"]').click();
  await expect(page).toHaveURL(/colors=red/);

  await clearFilters(page);
  await expect(page).not.toHaveURL(/types=bar/);
  await expect(page).not.toHaveURL(/colors=red/);
  expectNoPageFailures(failures);
});

test("publications view renders grouped rows and opens thumbnails", async ({ page }) => {
  const failures = attachPageGuards(page);

  await page.goto("/#/?view=publications");
  await expect(page.locator(".gallery-work-row").first()).toBeVisible();
  await expect(page.locator(".header-count")).toContainText("Publications");
  await expect(page.locator(".lightbox-carousel-title").first()).not.toBeEmpty();
  await page.locator(".gallery-work-row .lightbox-thumb").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectImageLoaded(page.locator(".lightbox-stage-full"));
  expectNoPageFailures(failures);
});

test("lightbox supports direct links, image rendering, keyboard navigation, and close", async ({
  page
}, testInfo) => {
  const failures = attachPageGuards(page);

  await page.goto(`/#/?id=${firstFigureId}`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".lightbox-close")).toBeFocused();
  await expect(page.locator(".lightbox-title")).toContainText(
    "Development of Men's and Women's Occupations"
  );
  await expectImageLoaded(page.locator(".lightbox-stage-full"));
  await page.keyboard.press("Shift+Tab");
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(document.activeElement?.closest(".lightbox-inner")))
    )
    .toBe(true);

  await testInfo.attach("lightbox", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(new RegExp(`id=${secondFigureId}`));
  await expect(page.locator(".lightbox-title")).toContainText("Age Groups and Occupations");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/id=/);
  expectNoPageFailures(failures);
});

test("about and terms content render", async ({ page }) => {
  const failures = attachPageGuards(page);

  await page.goto("/");
  await expect(page.locator(".gallery-item").first()).toBeVisible();

  await page.getByRole("button", { name: "About" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".about-close")).toBeFocused();
  await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
  await expectImageLoaded(page.locator(".about-photo"));
  await page.keyboard.press("Shift+Tab");
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(document.activeElement?.closest(".about-card")))
    )
    .toBe(true);
  await page.locator(".about-close").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Terms" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Terms of Use")).toBeVisible();
  expectNoPageFailures(failures);
});

test("mobile filters and lightbox previous/next controls work", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only interaction path");
  const failures = attachPageGuards(page);

  await page.goto("/");
  await expect(page.locator(".gallery-item").first()).toBeVisible();

  await page.getByRole("button", { name: /filters/i }).click();
  await expect(page.locator(".filters-panel")).toHaveClass(/is-open/);
  await page.locator(".filters-panel-apply").click();
  await expect(page.locator(".filters-panel")).not.toHaveClass(/is-open/);

  await page.goto(`/#/?id=${secondFigureId}`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page).toHaveURL(new RegExp(`id=${firstFigureId}`));
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(new RegExp(`id=${secondFigureId}`));
  expectNoPageFailures(failures);
});
