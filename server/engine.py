"""Versioned demonstration model, mirrored by client/src/sim.ts.

Sensor and effector numbers are illustrative training parameters, not real specifications.
The scorer reconstructs visibility and outcomes rather than trusting client telemetry.
"""
import copy
import math

HZ = 30
ENGINE_VERSION = "vyuha-0.2.0"
MASK = 0xFFFFFFFF


def sample(seed, tick, index, sensor):
    x = (seed ^ ((tick + 1) * 374761393) ^ ((index + 1) * 668265263) ^ ((sensor + 1) * 69069)) & MASK
    x = ((x ^ (x >> 13)) * 1274126177) & MASK
    return ((x ^ (x >> 16)) & MASK) / 4294967296


def rng(seed):
    a = seed & MASK
    def next_value():
        nonlocal a
        a = (a + 0x6D2B79F5) & MASK
        t = ((a ^ (a >> 15)) * (1 | a)) & MASK
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & MASK)) & MASK) ^ t
        return ((t ^ (t >> 14)) & MASK) / 4294967296
    return next_value


def make_scenario(seed=482913, focus="recognition", night=True):
    offset = math.floor(rng(seed)() * 18) - 9
    rows = [
        ("bird", "neutral", False, 0, 72, 155, .65, 22),
        ("quad", "friendly", True, 0, 285, 120, 1.1, 18),
        ("quad", "hostile", True, 60, 35, 140, 2.1, 26),
        ("fixed_wing", "hostile", False, 330, 120, 175, 2.8, 35),
        ("fiber_fpv", "hostile", False, 630, 320, 148, 3.8, 10),
        ("quad", "hostile", True, 1080, 15, 155, 3.2, 20),
        ("quad", "hostile", True, 1110, 26, 160, 3.2, 25),
        ("quad", "hostile", True, 1140, 38, 165, 3.2, 15),
    ]
    return dict(version=1, id=f"sc_{seed}_{'night' if night else 'day'}_{focus}", seed=seed,
                title="Silent approach" if focus == "response" else "Night watch" if night else "Day watch", duration=75,
                night=night, fog=.2, jamStart=660, jamEnd=900, focus=focus,
                tracks=[dict(id=f"T{i+1}", kind="fiber_fpv" if focus == "response" and i == 5 else x[0], identity=x[1], rf=False if focus == "response" and i == 5 else x[2], spawn=x[3],
                             bearing=x[4]+offset, distance=x[5], speed=x[6], altitude=x[7])
                        for i, x in enumerate(rows)])


def position(t, tick):
    age = max(0, (tick - t["spawn"]) / HZ)
    radius = max(0, t["distance"] - age * t["speed"])
    angle = t["bearing"] * math.pi / 180
    if t["identity"] != "hostile":
        radius = t["distance"] + math.sin(age * .16) * 14
        angle += age * (.028 if t["kind"] == "bird" else .012)
    return dict(x=math.sin(angle) * radius, z=math.cos(angle) * radius)


def civil(t):
    return t["x"] < -30 and t["z"] > 20


def ideal(t):
    return "hold" if t["identity"] != "hostile" else "rf_jam" if t["rf"] else "kinetic"


def js_round(x):
    return math.floor(x + .5)


class Simulation:
    def __init__(self, scenario):
        self.scenario = scenario
        self.tick = 0
        self.events = []
        self.commands = []
        self.radar_override = None
        self.radar_status = "normal"
        self.rf_available = True
        self.night = scenario["night"]
        self.paused = False
        self.tracks = [dict(**t, **position(t, 0), active=False, detected=None, designated=None,
                            classification=None, declared=None, resolved=False, impact=False,
                            radar=False, thermal=False, attempts=[]) for t in scenario["tracks"]]
        self.observe()

    def observe(self):
        s = self.scenario
        jammed = s["jamStart"] <= self.tick < s["jamEnd"]
        self.radar_status = self.radar_override or ("jammed" if jammed else "normal")
        factor = 0 if self.radar_status == "failed" else (.2 if self.radar_override == "jammed" else 0) if self.radar_status == "jammed" else 1
        for i, t in enumerate(self.tracks):
            t["active"] = self.tick >= t["spawn"] and not t["resolved"] and not t["impact"]
            if not t["active"]:
                t["radar"] = t["thermal"] = False
                continue
            t.update(position(t, self.tick))
            d = math.hypot(t["x"], t["z"])
            pr = max(.03, min(.98, 1 - (d/195)**4 - s["fog"]*.15))
            pt = max(.1, .95-s["fog"]*.5)
            t["radar"] = factor > 0 and d < 190 and sample(s["seed"], self.tick, i, 0) < pr*factor
            t["thermal"] = d < 145 and sample(s["seed"], self.tick, i, 1) < pt
            if t["detected"] is None and (t["radar"] or t["thermal"]):
                t["detected"] = self.tick
            if t["identity"] == "hostile" and d <= 8:
                t["impact"] = True
                t["active"] = False

    def step(self, force=False):
        if self.tick >= self.scenario["duration"]*HZ or (self.paused and not force):
            return
        self.tick += 1
        self.observe()

    def act(self, a):
        t = next((t for t in self.tracks if t["id"] == a["track"]), None)
        if self.paused or self.tick >= self.scenario["duration"]*HZ or not t or not t["active"] or t["detected"] is None or a["tick"] != self.tick:
            return False
        if a["k"] == "designate":
            if t["designated"] is None:
                t["designated"] = self.tick
        elif a["k"] == "classify":
            if t["designated"] is None or not a.get("kind") or not a.get("identity"):
                return False
            t["classification"] = a["kind"]
            t["declared"] = a["identity"]
        else:
            if t["designated"] is None or not t["classification"] or not a.get("effector"):
                return False
            effector = a["effector"]
            t["attempts"].append(effector)
            d = math.hypot(t["x"], t["z"])
            if effector != "hold" and d <= (160 if effector == "kinetic" else 180) and not (effector == "kinetic" and civil(t)) and (effector != "rf_jam" or t["rf"]):
                t["resolved"] = True
                t["active"] = False
        self.events.append(copy.deepcopy(a))
        return True

    def control(self, command):
        if any(c["seq"] == command["seq"] for c in self.commands):
            return False
        if command["seq"] != (self.commands[-1]["seq"] if self.commands else 0)+1 or command["tick"] != self.tick or self.tick >= self.scenario["duration"]*HZ:
            return False
        self.commands.append(copy.deepcopy(command))
        kind, payload = command["type"], command["payload"]
        if kind in ["pause", "resume"]:
            self.paused = kind == "pause"
        elif kind in ["inject_contact", "inject_swarm"]:
            count = 6 if kind == "inject_swarm" else 1
            aircraft = payload["kind"] if kind == "inject_contact" else "quad"
            for i in range(count):
                spec = dict(id=f"T{len(self.tracks)+1}", kind=aircraft, identity="hostile", rf=aircraft == "quad", spawn=self.tick,
                            bearing=(payload["bearing"]+i*5+360)%360, distance=130+math.floor(sample(self.scenario["seed"],command["seq"],i,7)*12),
                            speed=2.6 if aircraft == "quad" else 3.8, altitude=20+i%3*3 if aircraft == "quad" else 10)
                self.tracks.append(dict(**spec, **position(spec,self.tick), active=True, detected=None, designated=None,
                                        classification=None, declared=None, resolved=False, impact=False, radar=False, thermal=False, attempts=[]))
        elif kind == "sensor_fault":
            if payload["sensor"] == "radar":
                self.radar_override = payload["mode"]
            else:
                self.rf_available = False
        elif kind == "sensor_restore":
            if payload["sensor"] == "radar":
                self.radar_override = "normal"
            else:
                self.rf_available = True
        elif kind == "environment":
            self.night = payload["night"]
        self.observe()
        return True


def replay(scenario, events, end_tick, commands=None):
    sim = Simulation(scenario)
    commands = commands or []
    if commands and any("order" not in e for e in events):
        raise ValueError("Controlled sessions require trainee timeline order")
    timeline = [(e["tick"],e.get("order",i),"action",e) for i,e in enumerate(events)]
    timeline += [(c["tick"],c["order"],"command",c) for c in commands]
    # Do not silently repair malformed trainee logs.
    if any(events[i]["tick"] > events[i+1]["tick"] for i in range(len(events)-1)):
        raise ValueError("Events must be ordered")
    if commands and len({e[1] for e in timeline}) != len(timeline):
        raise ValueError("Timeline order must be unique")
    timeline.sort(key=lambda e:(e[0],e[1]))
    if commands and any(timeline[i][1]>=timeline[i+1][1] for i in range(len(timeline)-1)):
        raise ValueError("Timeline order must increase with simulation time")
    i = 0
    while sim.tick <= end_tick:
        while i < len(timeline) and timeline[i][0] == sim.tick:
            _,_,kind,e = timeline[i]
            if not (sim.control(e) if kind == "command" else sim.act(e)):
                raise ValueError(f"Invalid {kind} at tick {sim.tick}")
            i += 1
        if sim.tick == end_tick:
            break
        sim.step(force=True)
    if i != len(timeline):
        raise ValueError("Events must be ordered and inside the session")
    return sim


def score(sim):
    tracks = [t for t in sim.tracks if sim.tick >= t["spawn"]]
    threats = [t for t in tracks if t["identity"] == "hostile"]
    fratricide, breaches, rows = False, 0, []
    for t in tracks:
        is_threat = t["identity"] == "hostile"
        latency = None if t["detected"] is None or t["designated"] is None else (t["designated"]-t["detected"])/HZ
        detect = 0 if latency is None else js_round(25*max(0, min(1, (20-latency)/17)))
        classify = 25 if t["classification"] == t["kind"] and t["declared"] == t["identity"] else 12 if t["declared"] == t["identity"] and t["classification"] is not None else 0
        actions = [a for a in sim.events if a["track"] == t["id"] and a["k"] == "engage"]
        successful, feedback = False, []
        for a in actions:
            temp = {**t, **position(t, a["tick"])}
            d = math.hypot(temp["x"], temp["z"])
            restricted = a["effector"] == "kinetic" and civil(temp)
            if restricted:
                breaches += 1
                feedback.append("Kinetic action attempted in the restricted zone.")
            in_range = d <= (160 if a["effector"] == "kinetic" else 180)
            if a["effector"] != "hold" and in_range and not restricted and (a["effector"] != "rf_jam" or t["rf"]) and not is_threat:
                fratricide = True
            if a["effector"] == ideal(t) and in_range and not restricted:
                successful = True
        wrong = sum(a["effector"] != ideal(t) for a in actions)
        engage = max(0, 35-wrong*7) if successful else 0
        prioritise = (15 if t["resolved"] and not t["impact"] else 0) if is_threat else (15 if "hold" in t["attempts"] else 0)
        if latency is None:
            feedback.append("Designate the contact after a sensor first reveals it.")
        elif latency > 3:
            feedback.append(f"Designation took {latency:.1f} seconds after first sensor visibility.")
        if classify < 25:
            feedback.append(f"Reference classification: {t['kind'].replace('_', ' ')} / {t['identity']}.")
        if not successful:
            feedback.append("Hold fire on this non-hostile contact." if ideal(t) == "hold" else "RF-link present: RF jamming is the example-pack response." if t["rf"] else "No RF link: use an allowed kinetic response in this example pack.")
        if wrong:
            feedback.append(f"{wrong} unsuitable response{'s' if wrong > 1 else ''}; review the sensor evidence.")
        if t["impact"]:
            feedback.append("This threat reached the protected asset.")
        rows.append(dict(id=t["id"], kind=t["kind"], identity=t["identity"], detect=detect, classify=classify,
                         prioritise=prioritise, engage=engage, total=detect+classify+prioritise+engage,
                         detected=t["detected"], designated=t["designated"], ideal=ideal(t), feedback=feedback,
                         impact=t["impact"], attempts=t["attempts"]))
    relevant = [t for t in rows if t["identity"] == "hostile"]
    leakers = sum(t["impact"] for t in threats)
    raw = sum(t["total"] for t in relevant)/len(relevant) if relevant else 0
    result = 0 if fratricide else max(0, js_round(raw-leakers*10))
    recognition = js_round(sum(t["classify"] for t in rows)/(len(rows)*25)*100) if rows else 0
    response = js_round(sum(t["engage"] for t in rows)/(len(rows)*35)*100) if rows else 0
    summary = "Non-hostile engagement: session failed." if fratricide else f"{leakers} threat{'s' if leakers > 1 else ''} reached the protected asset. Review response selection." if leakers else "Good control. Repeat with a new scenario seed." if result >= 70 else "Review designation, classification, and response before the next drill."
    return dict(score=result, passed=result >= 70 and not fratricide and breaches == 0, fratricide=fratricide,
                roe_breaches=breaches, leakers=leakers, threats=len(threats), rows=rows,
                skills=dict(recognition=recognition, response=response), summary=summary, engine_version=ENGINE_VERSION)
