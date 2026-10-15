"""Native socket contracts, including closed HTTP connections. Not Linux certification."""
import importlib.util,json,os,socket,subprocess,sys
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[2]

def probe(port,tmp_path):
 env={**os.environ,'VYUHA_DB':str(tmp_path/'qa.db'),'VYUHA_SSL_CERTFILE':'','VYUHA_SSL_KEYFILE':''}
 return subprocess.run([sys.executable,str(ROOT/'scripts/preflight.py'),'--port',str(port)],env=env,text=True,capture_output=True,timeout=10)

@pytest.mark.parametrize('reuse',[False,True])
@pytest.mark.parametrize('host',['0.0.0.0','127.0.0.1'])
def test_preflight_never_masks_an_actual_listener(tmp_path,reuse,host):
 with socket.socket() as listener:
  if reuse:listener.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
  listener.bind((host,0));listener.listen(1)
  result=probe(listener.getsockname()[1],tmp_path)
  assert result.returncode==1 and 'Cannot open port' in result.stderr

@pytest.mark.skipif(os.name!='posix',reason='POSIX asyncio/Uvicorn reuse contract; nativeWindows remains separate')
@pytest.mark.parametrize('host',['0.0.0.0','127.0.0.1'])
def test_repeated_immediate_restart_after_active_http_connections(tmp_path,host):
 port=0
 for _ in range(5):
  with socket.socket() as listener:
   listener.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);listener.bind((host,port));port=listener.getsockname()[1];listener.listen(1)
   client=socket.create_connection(('127.0.0.1',port),timeout=2)
   connection,_=listener.accept()
   client.sendall(b'GET / HTTP/1.0\r\n\r\n');assert connection.recv(4096)
   connection.sendall(b'HTTP/1.0 200 OK\r\nContent-Length: 2\r\n\r\nOK');connection.shutdown(socket.SHUT_WR)
   while client.recv(4096):pass
   client.close();connection.close()
  result=probe(port,tmp_path);assert result.returncode==0,result.stderr


def lan():
 spec=importlib.util.spec_from_file_location('lan',ROOT/'scripts/lan-addresses.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def test_ip_json_uses_only_owned_local_addresses_not_broadcast():
 text=json.dumps([{'ifname':'wlp8s0','addr_info':[{'family':'inet','local':'172.20.10.3','prefixlen':28,'broadcast':'172.20.10.15'}]}])
 assert lan().parse_addresses(text,'ip-json')=={'172.20.10.3'}

def test_inet_parser_excludes_netmask_broadcast_and_peer_addresses():
 text='\tinet 172.20.10.3 netmask 0xfffffff0 broadcast 172.20.10.15\n    inet 192.168.3.255/23 brd 192.168.3.255 scope global wlan0\n    inet 127.0.0.1/8 scope host lo\n'
 assert lan().parse_addresses(text,'inet')=={'172.20.10.3','192.168.3.255'}

def test_address_enumeration_falls_back_without_hostname_dns_guess(monkeypatch):
 module=lan();commands=[]
 def run(command,**kwargs):
  commands.append(command)
  if command==['ifconfig']:return subprocess.CompletedProcess(command,0,' inet 10.1.2.3 netmask 255.255.255.0 broadcast 10.1.2.255','')
  raise FileNotFoundError()
 monkeypatch.setattr(module.subprocess,'run',run);assert module.addresses()==['10.1.2.3'];assert commands==[['ip','-j','-4','address','show','up'],['ifconfig']]
