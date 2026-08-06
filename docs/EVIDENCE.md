# Evidence Gallery

Screenshots proving each major capability actually works — not just configured.

## Application

**Live app UI** — the actual running application, real data, no placeholders.
![App running](images/evidence/app-live-ui.png)

## Home-Lab Cluster

**Nodes healthy** — the 3-node on-premises cluster, all `Ready`.
![On-prem cluster nodes](images/evidence/onprem-cluster-nodes.png)

**Full stack running** — application pods, Helm release, and the full monitoring stack (Prometheus, Grafana, Loki) all healthy in one view.
![App, Helm, and monitoring](images/evidence/app-running-helm-monitoring.png)

**ArgoCD sync status** — GitOps confirming the live cluster matches Git.
![ArgoCD sync status](images/evidence/argocd-sync-status.png)

**ArgoCD, Vault, and HPA together** — sync healthy, Vault pods running, and the Horizontal Pod Autoscaler active with real targets.
![ArgoCD, Vault, and HPA healthy](images/evidence/argocd-vault-hpa-healthy.png)

## Disaster Recovery

**Restored data, verified** — after a full namespace deletion and rebuild, the original test data is confirmed present and unchanged.
![DR drill restored data](images/evidence/dr-drill-restored-data.png)

## AWS Cloud Deployment

**EKS cluster** — the real, Terraform-provisioned AWS EKS cluster.
![EKS cluster](images/evidence/eks-cluster.png)

**EKS nodes** — the actual EC2 worker nodes, healthy and ready.
![EKS cluster nodes](images/evidence/eks-cluster-nodes.png)

**Terraform state** — Terraform's own record of every resource it created.
![Terraform state list](images/evidence/terraform-state-list.png)

**Terraform outputs** — cluster name, endpoint, and region, confirmed post-apply.
![Terraform outputs](images/evidence/terraform-outputs.png)

**AWS CLI confirmation** — resources verified independently of Terraform, directly via the AWS CLI.
![AWS CLI resources confirmed](images/evidence/aws-cli-resources-confirmed.png)
