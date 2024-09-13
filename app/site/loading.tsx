import Image from "next/image";
import LoadingScreenAnimation from './fade-stagger-squares.svg';
import styles from './layout.module.scss';

export default function LoadingScreen() {
    return (
        <Image className={styles.loadingScreenImage}
               alt="Loading screen animation"
               src={LoadingScreenAnimation}
               fill
        />
    )
}