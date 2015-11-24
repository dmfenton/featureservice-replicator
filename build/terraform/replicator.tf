provider "aws" {
  access_key = "${var.access_key}"
  secret_key = "${var.secret_key}"
  region = "${var.region}"
}

resource "aws_instance" "app_server" {
  depends_on = ["aws_vpc.replicator", "aws_subnet.replicator", "aws_internet_gateway.replicator", "aws_route_table.replicator"]
  ami = "ami-6e85c304"
  instance_type = "t1.micro"
  connection {
    user = "ubuntu"
    agent = false
    key_file = "${var.key_file}"
  }

  key_name = "${var.key_name}"
  vpc_security_group_ids = ["${aws_vpc.replicator.default_security_group_id}"]
  subnet_id = "${aws_subnet.replicator.id}"

  provisioner "remote-exec" {
    inline = [
     "pm2 start /srv/www/featureservice-replicator/server.js"
    ]
  }
  
  tags {
    Name = "Replicator"
  }
}

resource "aws_eip" "ip" {
  depends_on = ["aws_internet_gateway.replicator"]
  instance = "${aws_instance.app_server.id}"
  vpc = true
}

resource "aws_vpc" "replicator" {
  cidr_block = "10.0.0.0/16"
  tags {
    Name = "Replicator"
  }
}

resource "aws_subnet" "replicator" {
  vpc_id = "${aws_vpc.replicator.id}"
  cidr_block = "10.0.0.0/16"
  map_public_ip_on_launch = true
  availability_zone = "us-east-1a"
  tags {
    Name = "Replicator"
  }
}

resource "aws_internet_gateway" "replicator" {
  depends_on = ["aws_vpc.replicator"]
  vpc_id = "${aws_vpc.replicator.id}"
  tags {
    Name = "Replicator"
  }
}

resource "aws_route_table" "replicator" {
  vpc_id = "${aws_vpc.replicator.id}"
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = "${aws_internet_gateway.replicator.id}"
  }
  tags {
    Name = "Replicator"
  }
}

resource "aws_route_table_association" "replicator" {
  subnet_id = "${aws_subnet.replicator.id}"
  route_table_id = "${aws_route_table.replicator.id}"
}

resource "aws_main_route_table_association" "replicator" {
  vpc_id = "${aws_vpc.replicator.id}"
  route_table_id = "${aws_route_table.replicator.id}"
}

resource "aws_security_group_rule" "allow_http" {
  depends_on = ["aws_vpc.replicator"]
  type = "ingress"
  from_port = 80
  to_port = 80
  protocol = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
  security_group_id = "${aws_vpc.replicator.default_security_group_id}"
}

resource "aws_security_group_rule" "allow_express" {
  depends_on = ["aws_vpc.replicator"]
  type = "ingress"
  from_port = 3000
  to_port = 3000
  protocol = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
  security_group_id = "${aws_vpc.replicator.default_security_group_id}"
}


resource "aws_security_group_rule" "allow_ssh" {
  depends_on = ["aws_vpc.replicator"]
  type = "ingress"
  from_port = 22
  to_port = 22
  protocol = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
  security_group_id = "${aws_vpc.replicator.default_security_group_id}"
}


