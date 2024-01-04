import Image from "next/image";
import LoadingScreenAnimation from './fade-stagger-squares.svg';
import styles from './layout.module.scss';

export default function LoadingScreen() {
    return (
        <div>
            <Image className={styles.loadingScreenImage}
                   alt="Loading screen animation"
                   src={LoadingScreenAnimation}
                   fill
            />
        </div>
    )
}