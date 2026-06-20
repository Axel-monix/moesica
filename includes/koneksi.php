<?php
$host = "localhost";
$user = "root";
$pass = ""; // Default Laragon biasanya kosong
$db   = "db_moesica";

$conn = mysqli_connect($host, $user, $pass, $db);

if (!$conn) {
    die("Koneksi gagal: " . mysqli_connect_error());
}
?>