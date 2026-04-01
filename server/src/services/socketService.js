export let io = null

export function setIo(socketIo) {
  io = socketIo
}

export function getIo() {
  if (!io) {
    throw new Error('Socket.io not initialized yet')
  }
  return io
}
