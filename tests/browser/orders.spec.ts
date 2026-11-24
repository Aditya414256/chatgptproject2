import { test, expect } from "@playwright/test";
test("two tabs place, accept and complete a prescription pickup", async ({
  page,
  context,
}) => {
  const owner = await context.newPage();
  await owner.goto("/");
  await owner.getByRole("button", { name: "Pharmacy workspace" }).click();
  await page.goto("/");
  await page.getByRole("button", { name: "Customer counter" }).click();
  await page.getByLabel("Add Amoxicillin", { exact: true }).click();
  await page.getByRole("button", { name: "Choose fulfilment" }).click();
  await page.getByLabel("Pincode").fill("425405");
  await expect(page.getByText(/Bring your prescription/)).toBeVisible();
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await page
    .locator(".row")
    .filter({ hasText: "Riverbend Pharmacy" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(owner.getByText("New pharmacy order received.")).toBeVisible();
  const code = await page
    .getByText(/Handover code/)
    .locator("strong")
    .innerText();
  await owner.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.locator("article em")).toHaveText("accepted");
  await owner.getByRole("button", { name: "Mark ready" }).click();
  await owner.getByLabel("Customer handover code").fill(code);
  await owner.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.locator("article em")).toHaveText("completed");
});
test("delivery requires a file and supports owner viewing", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Customer counter" }).click();
  await page.getByLabel("Add Amoxicillin", { exact: true }).click();
  await page.getByRole("button", { name: "Choose fulfilment" }).click();
  await page.getByLabel("Fulfilment", { exact: true }).selectOption("delivery");
  await page.getByLabel("Delivery address").fill("Demo Road 1");
  await page.getByLabel("Pincode").fill("425405");
  await page
    .locator(".row")
    .filter({ hasText: "Riverbend Pharmacy" })
    .getByRole("button")
    .click();
  await expect(
    page.getByRole("button", { name: "Place order" }),
  ).toBeDisabled();
  await page.locator("input[type=file]").setInputFiles({
    name: "test.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 demo fixture"),
  });
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.locator("article em")).toHaveText("pending");
  const owner = await context.newPage();
  await owner.goto("/");
  await owner.getByRole("button", { name: "Pharmacy workspace" }).click();
  await expect(
    owner.getByRole("button", { name: "View prescription" }),
  ).toBeVisible();
  await owner.getByRole("button", { name: "View prescription" }).click();
  await expect(owner.getByTitle("Prescription viewer")).toHaveAttribute(
    "src",
    /^blob:/,
  );
});

test("competing tabs cannot both reserve the last unit", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.getByRole("button", { name: "Customer counter" }).click();
  // Create a deterministic single-unit fixture through the normal inventory screen.
  const owner = await context.newPage();
  await owner.goto("/");
  await owner.getByRole("button", { name: "Pharmacy workspace" }).click();
  await owner.getByRole("link", { name: "Inventory" }).click();
  await owner
    .locator(".row")
    .filter({ hasText: "Paracetamol" })
    .getByLabel("Stock")
    .fill("1");
  await owner.getByRole("button", { name: "Save changes" }).click();
  await expect(owner.getByText("Store saved.")).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: "Customer counter" }).click();
  for (const buyer of [page, second]) {
    await buyer.getByLabel("Add Paracetamol", { exact: true }).click();
    await buyer.getByRole("button", { name: "Choose fulfilment" }).click();
    await buyer.getByLabel("Pincode").fill("425405");
    await buyer
      .locator(".row")
      .filter({ hasText: "Riverbend Pharmacy" })
      .getByRole("button")
      .click();
  }
  await Promise.all(
    [page, second].map((b) =>
      b.getByRole("button", { name: "Place order" }).click(),
    ),
  );
  await owner.getByRole("link", { name: /Orders/ }).click();
  await expect(owner.locator("article.order")).toHaveCount(1);
  const result = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("fm-workshop-v2")!),
  );
  expect(result.shops[0].stock.m1).toBe(0);
  expect(result.orders.length).toBe(1);
});

test("unanswered normal pickup expires and returns stock", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Customer counter" }).click();
  await page.getByLabel("Add Paracetamol", { exact: true }).click();
  await page.getByRole("button", { name: "Choose fulfilment" }).click();
  await page.getByLabel("Pincode").fill("425405");
  await page
    .locator(".row")
    .filter({ hasText: "Riverbend Pharmacy" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.locator("article em")).toHaveText("pending");
  const stock = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("fm-workshop-v2")!).shops[0].stock.m1,
    );
  const reserved = await stock();
  await page.clock.fastForward(610000);
  await expect(page.locator("article em")).toHaveText("expired");
  expect(await stock()).toBe(reserved + 1);
});
