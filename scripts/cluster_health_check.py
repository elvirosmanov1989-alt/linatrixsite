import subprocess

def count_ready(command) : 
    result = subprocess.run(command, capture_output=True, text=True)
    lines = result.stdout.splitlines()
    ready_count = 0
    for line in lines:
        if "Ready" in line or "Running" in line or "Deployment" in line:
            ready_count = ready_count + 1
    return ready_count

cluster_name = "linatrixsite home-lab"
print("Checking cluster health for:", cluster_name)

nodes_ready = count_ready(["kubectl","get","nodes"])
print("Nodes Ready:", nodes_ready)

pods_ready = count_ready(["kubectl", "get", "pods","-n", "family-task-app"])
print("Pods Running:", pods_ready)

hpa_ready = count_ready(["kubectl", "get", "hpa","-n","family-task-app"])
print("HPA Running", hpa_ready)

