"""Print owned interface IPv4 addresses; never infer ownership from broadcasts/DNS."""
import ipaddress,json,re,subprocess,sys


def usable(value):
    try:
        address=ipaddress.IPv4Address(value)
        return address.is_private and not (address.is_loopback or address.is_link_local or address.is_unspecified or address.is_multicast)
    except ValueError:return False


def parse_addresses(output,kind):
    if kind=='ip-json':
        rows=json.loads(output)
        return {a['local'] for row in rows for a in row.get('addr_info',[]) if a.get('family')=='inet' and usable(a.get('local',''))}
    if kind=='hostname':values=output.split()
    else:values=re.findall(r'^\s*inet\s+(?:addr:)?([0-9.]+)(?:/\d+)?\b',output,re.M)
    return {value for value in values if usable(value)}


def addresses():
    for command,kind in [(['ip','-j','-4','address','show','up'],'ip-json'),(['ifconfig'],'inet'),(['ip','-4','addr'],'inet'),(['hostname','-I'],'hostname')]:
        try:
            result=subprocess.run(command,capture_output=True,text=True,timeout=3)
            found=parse_addresses(result.stdout,kind) if result.returncode==0 else set()
            if found:return sorted(found)
        except (FileNotFoundError,subprocess.TimeoutExpired,ValueError,TypeError,KeyError):pass
    return []


if __name__=='__main__':
    found=addresses()
    for address in found:print(address)
    if not found:print('No owned LAN address detected. Find this machine’s Wi-Fi/Ethernet IPv4 address in network settings.',file=sys.stderr)
