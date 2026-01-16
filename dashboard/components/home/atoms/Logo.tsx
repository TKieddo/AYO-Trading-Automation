export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="grid grid-cols-2 gap-1" style={{ width: size, height: size }}>
      <div className="bg-white rounded-sm" style={{ width: size / 2 - 4, height: size / 2 - 4 }}></div>
      <div className="bg-white rounded-sm" style={{ width: size / 2 - 4, height: size / 2 - 4 }}></div>
      <div className="bg-white rounded-sm" style={{ width: size / 2 - 4, height: size / 2 - 4 }}></div>
      <div className="bg-white rounded-sm" style={{ width: size / 2 - 4, height: size / 2 - 4 }}></div>
    </div>
  );
}
