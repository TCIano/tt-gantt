import assert from 'node:assert/strict';
import playwright from '/tmp/pw/node_modules/playwright/index.mjs';

const { chromium } = playwright;

async function dragMouse(page, from, to, steps = 18) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await page.mouse.move(x, y);
    await page.waitForTimeout(20);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('http://127.0.0.1:4173/');
  await page.waitForSelector('.gantt-right');

  const right = page.locator('.gantt-right');
  const task11 = page.locator('.gantt-bar-container', { hasText: 'Task 1.1' });
  const task12 = page.locator('.gantt-bar-container', { hasText: 'Task 1.2' });
  const task2 = page.locator('.gantt-bar-container', { hasText: 'Project Beta' });

  await assert.doesNotReject(() => task11.waitFor({ state: 'visible' }));
  await assert.doesNotReject(() => task12.waitFor({ state: 'visible' }));
  await assert.doesNotReject(() => task2.waitFor({ state: 'visible' }));

  const rightBox = await right.boundingBox();
  assert(rightBox, '右侧时间轴容器不存在');

  const pathsBefore = await page.locator('.gantt-link-path').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('d'))
  );
  assert(pathsBefore.length > 0, '依赖线初始 path 缺失');

  const task12Box = await task12.boundingBox();
  assert(task12Box, 'Task 1.2 不可见');

  await dragMouse(
    page,
    { x: task12Box.x + task12Box.width / 2, y: task12Box.y + task12Box.height / 2 },
    { x: task12Box.x + task12Box.width / 2 - 60, y: task12Box.y + task12Box.height / 2 },
    12
  );
  await page.waitForTimeout(80);
  const draggingClassActive = await task12.evaluate((node) => node.classList.contains('is-dragging'));
  assert(draggingClassActive, '自动化脚本未命中任务条拖拽热点');
  const task12PreviewBox = await task12.boundingBox();
  assert(task12PreviewBox && task12PreviewBox.x < task12Box.x, '拖拽预览期间任务条未跟随移动');
  const pathsPreview = await page.locator('.gantt-link-path').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('d'))
  );
  const previewPathChanged = pathsPreview.some((path, index) => path !== pathsBefore[index]);
  assert(previewPathChanged, '拖拽中依赖线没有跟随预览变化');
  await page.mouse.up();
  await page.waitForTimeout(120);

  const task11Box = await task11.boundingBox();
  assert(task11Box, 'Task 1.1 不可见');
  await page.mouse.move(task11Box.x + task11Box.width / 2, task11Box.y + task11Box.height / 2);
  await page.mouse.down();
  const samples = [];
  for (let i = 0; i < 18; i += 1) {
    const x = task11Box.x + task11Box.width / 2 - 220 - i * 12;
    const y = task11Box.y + task11Box.height / 2;
    await page.mouse.move(x, y);
    await page.waitForTimeout(24);
    const sample = await page.evaluate(() => {
      const container = document.querySelector('.gantt-right');
      const bar = [...document.querySelectorAll('.gantt-bar-container')].find(
        (el) => el.textContent && el.textContent.includes('Task 1.1')
      );
      const rect = bar?.getBoundingClientRect();
      return {
        scrollLeft: container ? container.scrollLeft : -1,
        x: rect ? rect.x : -1,
        width: rect ? rect.width : -1
      };
    });
    samples.push(sample);
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
  assert(samples.some((item) => item.scrollLeft > 0), '左侧预扩展未触发滚动锚点补偿');
  assert(samples.every((item) => item.x > rightBox.x - 260), '左拖过程中任务条出现异常跳出视口');

  const task2Box = await task2.boundingBox();
  assert(task2Box, 'Project Beta 不可见');
  const rightHandleX = task2Box.x + task2Box.width + 3;
  const rightHandleY = task2Box.y + task2Box.height / 2;
  await dragMouse(
    page,
    { x: rightHandleX, y: rightHandleY },
    { x: rightBox.x + rightBox.width - 12, y: rightHandleY },
    14
  );
  await page.mouse.up();
  await page.waitForTimeout(120);
  const task2AfterBox = await task2.boundingBox();
  assert(task2AfterBox && task2AfterBox.width >= task2Box.width, '右侧 Resize 未生效');

  assert.equal(pageErrors.length, 0, `页面运行期报错: ${pageErrors.join(' | ')}`);
  console.log(
    JSON.stringify(
      {
        dragPreviewPathChanged: previewPathChanged,
        dragClassActive: draggingClassActive,
        taskPreviewMoved: task12PreviewBox.x < task12Box.x,
        leftExpandTriggered: samples.some((item) => item.scrollLeft > 0),
        resizeWidthBefore: task2Box.width,
        resizeWidthAfter: task2AfterBox.width
      },
      null,
      2
    )
  );

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
