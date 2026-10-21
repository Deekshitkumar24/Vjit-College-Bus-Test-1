import { FleetSimulatorManager } from './fleet-manager.js';
import { assertSimulatorEnvironment } from './guards.js';

export { FleetSimulatorManager } from './fleet-manager.js';
export { SimulatedBusAgent } from './bus-agent.js';
export type { BusScenarioMode } from './bus-agent.js';
export { assertSimulatorEnvironment } from './guards.js';
export { SYNTHETIC_CORRIDORS } from './route-paths.js';

function main() {
  const appEnv = process.env['APP_ENV'] || 'local';
  const targetUrl = process.env['SIMULATOR_TARGET_URL'] || 'http://localhost:3000';
  const ticks = parseInt(process.env['SIMULATOR_TICKS'] || '6', 10);

  console.log('================================================================');
  console.log('COLLEGE BUS TRACKER - 50-BUS FLEET SIMULATOR (P1-T11, R-M5)');
  console.log(`Environment: ${appEnv} | Target: ${targetUrl} | Ticks: ${ticks}`);
  console.log('================================================================');

  try {
    assertSimulatorEnvironment(appEnv, targetUrl);
    const manager = new FleetSimulatorManager(appEnv, targetUrl);

    console.log(`Fleet initialized with ${manager.getBuses().length} buses.`);
    const summary = manager.runSimulation(ticks);

    console.log('\n--- SIMULATION SUMMARY ---');
    console.log(`Total Buses: ${summary.totalBuses}`);
    console.log(`Ticks Run: ${summary.totalTicks}`);
    console.log(`Telemetry Batches: ${summary.totalHardwareBatches}`);
    console.log(`Driver Phone Samples: ${summary.totalDriverSamples}`);
    console.log(`Heartbeats: ${summary.totalHeartbeats}`);
    console.log(`Events: ${summary.totalEvents}`);
    console.log(`Errors: ${summary.errors.length}`);
    console.log('Scenario Breakdown:', summary.scenarioBreakdown);

    if (summary.errors.length > 0) {
      console.error('Simulation finished with errors:', summary.errors);
      process.exit(1);
    }

    console.log('\nFleet simulation completed successfully with zero errors.');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Simulator Execution Failed:', msg);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('index.ts')) {
  main();
}
