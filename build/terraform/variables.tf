variable "access_key" {}
variable "secret_key" {}
variable "region" {
  default = "us-east-1"
}
variable "amis" {
  default = {
    us-east-1 = "ami-aa7ab6c2"
  }
}
variable "key_name" {}
variable "key_file" {}

