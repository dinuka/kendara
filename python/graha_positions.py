from flatlib.chart import Chart
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib import const

# --------------------------------------------------
# Birth Details
# --------------------------------------------------
# Date: 1987-04-24
# Time: 23:50
# Place: Sri Jayawardenepura General Hospital, Sri Lanka
# Coordinates (approx.): 6.88N, 79.89E
# Timezone: +05:30
# --------------------------------------------------

date = Datetime('1987/04/24', '23:50', '+05:30')
pos = GeoPos('6n53', '79e53')

chart = Chart(date, pos)

grahas = [
    const.SUN,
    const.MOON,
    const.MERCURY,
    const.VENUS,
    const.MARS,
    const.JUPITER,
    const.SATURN,
    const.NORTH_NODE,  # Rahu
    const.SOUTH_NODE,  # Ketu
]

print("=" * 60)
print("GRAHA POSITIONS")
print("=" * 60)

for graha in grahas:
    obj = chart.get(graha)

    print(f"\n{obj.id}")
    print("-" * 30)
    print(f"Sign       : {obj.sign}")
    print(f"Longitude  : {obj.lon:.6f}°")
    print(f"Sign Degree: {obj.signlon:.6f}°")
    print(f"House      : {obj.house}")
    print(f"Latitude   : {obj.lat:.6f}°")
    print(f"Speed      : {obj.lonspeed:.6f}")

asc = chart.get(const.ASC)

print("\n" + "=" * 60)
print("ASCENDANT (LAGNA)")
print("=" * 60)
print(f"Sign       : {asc.sign}")
print(f"Longitude  : {asc.lon:.6f}°")
print(f"Sign Degree: {asc.signlon:.6f}°")
print(f"House      : {asc.house}")

print("\n" + "=" * 60)
print("HOUSES")
print("=" * 60)

for i in range(1, 13):
    house = chart.houses.get(str(i))
    print(
        f"House {i:>2}: "
        f"{house.sign} "
        f"({house.lon:.6f}°)"
    )