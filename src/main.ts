import { Scatterplot } from "./scatterplot";

async function run() {
  const canvas = document.getElementById("gpuCanvas") as HTMLCanvasElement;
  if (!canvas) {
    console.error("Canvas not found.");
    return;
  }

  const scatterplot = new Scatterplot(canvas);
  await scatterplot.init();

  const points = new Array(10)
    .fill(0)
    .map(() => [Math.random() * 2 - 1, Math.random() * 2 - 1]);

  scatterplot.setData(points, {
    colors: "#FF0000",
    sizes: 50,
    opacity: 1.0,
    strokeColors: "#000000",
    strokeWidths: 4,
  });

  scatterplot.render();
}

run();
