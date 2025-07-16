export function getSpeedLimit() {
  return 30; // mock for now
}

export function getSpeedColorStyle(speed, speedLimit) {
  if (speed <= speedLimit) return { color: 'green' };
  if (speed <= speedLimit + 10) return { color: 'orange' };
  return { color: 'red' };
}