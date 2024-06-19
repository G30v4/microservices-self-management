import netifaces

def get_host_ip():
    interfaces = netifaces.interfaces()
    for interface in interfaces:
        if interface.startswith('eth') or interface.startswith('en'):
            addresses = netifaces.ifaddresses(interface)
            if netifaces.AF_INET in addresses:
                return addresses[netifaces.AF_INET][0]['addr']
    return None
