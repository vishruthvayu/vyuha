"""Print candidate local interface addresses without contacting the internet."""
import ipaddress,re,socket,subprocess,sys
found=set()
for command in [['ifconfig'],['ip','-4','addr'],['hostname','-I']]:
    try:
        result=subprocess.run(command,capture_output=True,text=True,timeout=3)
        if result.returncode==0:
            for candidate in re.findall(r'\b(?:\d{1,3}\.){3}\d{1,3}\b',result.stdout):
                try:
                    addr=ipaddress.ip_address(candidate)
                    if addr.is_private and not addr.is_loopback and not addr.is_link_local and candidate!='255.255.255.255' and not candidate.endswith('.0') and not candidate.endswith('.255'):found.add(candidate)
                except ValueError:pass
            if found:break
    except (FileNotFoundError,subprocess.TimeoutExpired):pass
if not found:
    try:
        for row in socket.getaddrinfo(socket.gethostname(),None,socket.AF_INET):
            addr=ipaddress.ip_address(row[4][0])
            if addr.is_private and not addr.is_loopback and not addr.is_link_local:found.add(str(addr))
    except OSError:pass
for address in sorted(found):print(address)
if not found:print('No LAN address detected. Find this machine’s Wi-Fi/Ethernet IPv4 address in network settings.',file=sys.stderr)
